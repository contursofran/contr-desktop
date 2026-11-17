import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
// Programs that do not exist. The launcher allows a switch only in the repository or the temp folder.
const missing = path.join(e2e, "missing");

const base = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

/** Counts the renderer's "listen to the feed" calls: each one starts the feed again in main. */
async function countFeedStarts(app: ElectronApplication) {
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as { feedStarts?: number };
    g.feedStarts = 0;
    ipcMain.on("contr:feed-ready", () => (g.feedStarts = (g.feedStarts ?? 0) + 1));
  });
  return () => app.evaluate(() => (globalThis as { feedStarts?: number }).feedStarts ?? 0);
}

test("a helper error is a block in the reading column: plain words, the error, the path, Retry; the reply box is off and no orchestrator text shows", async () => {
  test.setTimeout(60_000);
  const flag = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-flag-")), "down");
  writeFileSync(flag, "");
  const app = await launchApp({ ...base, FAKE_HELPER_ERROR_WHILE: flag });
  const page = await app.firstWindow();
  // The sidebar's first read is done: its agents show the orchestrator text, the chat does not.
  await expect(page.getByRole("navigation", { name: "Projects" }).getByText("Orchestrating · 3 workers")).toBeVisible();
  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect(alert.locator("p").first()).toHaveText("hc is not running.");
  await expect(alert.locator("pre")).toHaveText("no-core: fake error no-core");
  await expect(alert.getByLabel("Helper path")).toHaveText(base.CONTR_HELPER);
  // In the column: the block's sides are the reply box's, with a classic scrollbar too (as on the CI runner).
  await page.addStyleTag({ content: "::-webkit-scrollbar { width: 15px; }" });
  const block = (await alert.boundingBox())!;
  const reply = (await page.getByRole("form", { name: "Reply" }).boundingBox())!;
  expect(Math.abs(block.x - reply.x)).toBeLessThan(1);
  expect(Math.abs(block.width - reply.width)).toBeLessThan(1);
  await expect(page.getByRole("textbox", { name: /^Reply to/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Attach image" })).toBeDisabled();
  await expect(page.getByRole("main").getByText(/Orchestrating/)).toHaveCount(0);
  await shoot(page, "helper-error");

  // Retry starts the feed again.
  const starts = await countFeedStarts(app);
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect.poll(starts).toBe(1);
  // The helper back: the chat, the reply box and the orchestrator text come back.
  rmSync(flag);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /^Reply to/ })).toBeEnabled();
  await expect(page.getByRole("main").getByText("Orchestrating · 3 workers")).toBeVisible();
  await app.close();
});

test("a missing helper says so, with its path", async () => {
  const app = await launchApp({ ...base, CONTR_HELPER: path.join(missing, "helper") });
  const page = await app.firstWindow();
  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect(alert.locator("p").first()).toHaveText("The herdr-contr helper is missing.");
  await expect(alert.locator("pre")).toContainText(`helper: spawn ${path.join(missing, "helper")} ENOENT`);
  await expect(alert.getByLabel("Helper path")).toHaveText(path.join(missing, "helper"));
  await expect(page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Install health check" })).toBeVisible();
  await shoot(page, "helper-missing");
  await app.close();
});

test("with no agents the main area says how one shows, and the sidebar says No agents", async () => {
  const app = await launchApp({ ...base, FAKE_HC_AGENTS: "", CONTR_TERMINAL: "" });
  const page = await app.firstWindow();
  const empty = page.getByRole("status", { name: "No agent" });
  await expect(empty).toHaveText("No agents yetAn agent that runs in an hc terminal shows here.");
  await expect(page.getByRole("navigation", { name: "Projects" }).getByText("No agents", { exact: true })).toBeVisible();
  await shoot(page, "no-agents");
  await app.close();
});

test("with an hc that cannot run the main area says hc is not reachable, with the error", async () => {
  const app = await launchApp({ ...base, CONTR_HC: path.join(missing, "hc"), CONTR_TERMINAL: "" });
  const page = await app.firstWindow();
  const note = page.getByRole("alert", { name: "hc error" });
  await expect(note.locator("p")).toHaveText("hc is not reachable.");
  await expect(note.locator("pre")).toContainText(`spawn ${path.join(missing, "hc")} ENOENT`);
  await expect(page.getByRole("navigation", { name: "Projects" }).getByText("hc is not reachable", { exact: true })).toBeVisible();
  await shoot(page, "no-hc");
  await app.close();
});

test("with more tabs than fit, the tab row's scrollbar is below the tabs, not on them", async () => {
  test.setTimeout(60_000);
  const app = await launchApp(base);
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(900);
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  for (const name of ["Install health check", "Release notes draft", /^Cards/, /^Flow/, /^Virtual/]) {
    await nav.getByRole("button", { name }).first().click();
    await expect(tabs.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
  }
  const row = tabs.locator("[data-tab-row]");
  const m = await row.evaluate((r: HTMLElement) => {
    const box = r.getBoundingClientRect();
    const tab = r.querySelector('[role="tab"][aria-selected="true"]')!.parentElement!.getBoundingClientRect();
    const bar = r.closest(".h-10")!.getBoundingClientRect();
    return { scroll: r.scrollWidth > r.clientWidth, scrollbar: r.offsetHeight - r.clientHeight, gap: box.top + r.clientHeight - tab.bottom, tab: tab.height, bar: bar.height };
  });
  expect(m.scroll).toBe(true);
  expect(m.scrollbar).toBeGreaterThan(0);
  // At least 2 px between the shown tab's box and the scrollbar.
  expect(m.gap).toBeGreaterThanOrEqual(2);
  expect(m.tab).toBe(29);
  expect(m.bar).toBe(40);
  await shoot(page, "tabs-scrollbar-narrow");
  await app.close();
});
