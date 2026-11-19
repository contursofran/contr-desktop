import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("helper plan usage reaches the sidebar foot", async () => {
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
  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect(usage.getByRole("listitem")).toHaveText(["Claude64% wk · 4d", "Codex21% 5h · 3h"]);
  await expect(usage.getByRole("meter", { name: "Claude usage" })).toHaveAttribute("aria-valuenow", "64");
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
  let show = page.getByRole("button", { name: "Show sidebar" });
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
  expect(await show.evaluate((e) => getComputedStyle(e).getPropertyValue("-webkit-app-region"))).toBe("no-drag");
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
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab")).toHaveText(["Chat panel usability audit", "Release notes draft"]);
  await expect(show).toHaveCount(0);
  await app.close();
});
