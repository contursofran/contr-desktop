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

test("Retry on a helper error starts the feed again through IPC", async () => {
  test.setTimeout(60_000);
  const flag = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-flag-")), "down");
  writeFileSync(flag, "");
  const app = await launchApp({ ...base, FAKE_HELPER_ERROR_WHILE: flag });
  const page = await app.firstWindow();
  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect(alert.locator("p").first()).toHaveText("hc is not running.");
  await expect(alert.locator("pre")).toHaveText("no-core: fake error no-core");
  await expect(alert.getByLabel("Helper path")).toHaveText(base.CONTR_HELPER);
  // Retry starts the feed again.
  const starts = await countFeedStarts(app);
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect.poll(starts).toBe(1);
  // The restarted feed supplies chat rows when the helper is back.
  rmSync(flag);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Chat" })).toContainText("Run it with:");
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
