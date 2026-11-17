import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("the sidebar head has the machine switch, the foot the plan usage and Settings", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  });
  const page = await app.firstWindow();
  const head = page.locator("aside > header");
  await expect(head).toContainText("contr");
  await expect(head.getByRole("button", { name: "Machine" })).toHaveText("This computer");
  const label = head.getByTestId("machine-label");
  expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  // Search and the foot's Add machine do nothing yet: inert, as the top bar's +.
  await expect(head.getByRole("button", { name: "Search" })).toHaveAttribute("aria-disabled", "true");
  await expect(head.getByRole("button", { name: "Hide sidebar" })).toBeVisible();

  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect(usage.getByRole("listitem")).toHaveText(["Claude64% wk · 4d", "Codex21% 5h · 3h"]);
  await expect(usage.getByRole("meter", { name: "Claude usage" })).toHaveAttribute("aria-valuenow", "64");
  await expect(page.locator("aside > footer").getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.locator("aside > footer").getByRole("button", { name: "Add machine" })).toHaveAttribute("aria-disabled", "true");

  await expect(page.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "sidebar-head-foot-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "sidebar-head-foot-light.png") });

  await app.close();
});

test("Hide sidebar hides it, the top bar shows it again clear of the window buttons, and the state stays over a restart", async () => {
  test.setTimeout(60_000);
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  const env = {
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  };
  let app = await launchApp(env, dataDir);
  let page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(900);
  let show = page.getByRole("tablist", { name: "Tabs" }).locator("..").getByRole("button", { name: "Show sidebar" });
  await expect(show).toHaveCount(0);
  await page.locator("aside > header").getByRole("button", { name: "Hide sidebar" }).click();
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(show).toBeVisible();
  // The top bar starts at the window's left; on macOS its first control sits right of the window buttons (76 px, as the sidebar head).
  const bar = (await show.locator("..").boundingBox())!;
  expect(bar.x).toBe(0);
  const box = (await show.boundingBox())!;
  const mac = await page.evaluate(() => window.contr.platform === "darwin");
  expect(box.x).toBe(mac ? 76 : 10);
  expect([box.width, box.height]).toEqual([28, 28]);
  expect(await show.evaluate((e) => getComputedStyle(e).getPropertyValue("-webkit-app-region"))).toBe("no-drag");
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `sidebar-hidden-${scheme}.png`) });
  }
  await app.close();

  // Hidden after a restart; Show sidebar brings it back, and that stays too.
  app = await launchApp(env, dataDir);
  page = await app.firstWindow();
  show = page.getByRole("button", { name: "Show sidebar" });
  await expect(show).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);
  await show.click();
  await expect(page.locator("aside > header").getByRole("button", { name: "Hide sidebar" })).toBeVisible();
  await expect(show).toHaveCount(0);
  await app.close();
  app = await launchApp(env, dataDir);
  page = await app.firstWindow();
  show = page.getByRole("button", { name: "Show sidebar" });
  await expect(page.locator("aside > header").getByRole("button", { name: "Hide sidebar" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab")).toHaveText(["Chat panel usability audit"]);
  await expect(show).toHaveCount(0);
  await app.close();
});

test("Add machine… in the machine menu is inert and says so", async () => {
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  await page.locator("aside > header").getByRole("button", { name: "Machine" }).click();
  const add = page.getByRole("menu", { name: "Machine" }).getByRole("menuitem", { name: "Add machine…" });
  await expect(add).toHaveAttribute("aria-disabled", "true");
  const color = (v: string) => page.evaluate((v) => { const e = document.createElement("span"); e.style.color = `var(${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }, v);
  expect(await add.evaluate((e) => getComputedStyle(e).color)).toBe(await color("--color-faint"));
  await add.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Add machine (not yet)");
  await add.click({ force: true });
  await expect(add).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `machine-add-inert-${scheme}.png`) });
  }
  await app.close();
});
