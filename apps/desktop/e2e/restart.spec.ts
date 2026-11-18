import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
// An empty CONTR_TERMINAL (the launcher gives "t1"): the app picks the agent itself, as the real app does.
const env = {
  CONTR_TERMINAL: "",
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

const shown = (page: Page) => page.getByRole("navigation", { name: "Projects" }).locator('[aria-current="true"]');
const terminalPick = (page: Page) => page.getByRole("radiogroup", { name: "Chat or Terminal" }).getByRole("radio", { name: "Terminal" });

test("the shown agent and the Chat / Terminal pick stay over a restart", async () => {
  test.setTimeout(60_000);
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  let app = await launchApp(env, data);
  let page = await app.firstWindow();
  // No stored agent: the first agent of the list shows.
  await expect(shown(page)).toHaveAccessibleName(/Chat panel usability audit/);
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Install health check" }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Install health check" })).toBeVisible();
  await terminalPick(page).click();
  await expect(terminalPick(page)).toBeChecked();
  // The pick is one for the window: it stays when another agent shows.
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Release notes draft" }).click();
  await expect(shown(page)).toHaveAccessibleName(/Release notes draft/);
  await expect(terminalPick(page)).toBeChecked();
  await app.close();

  app = await launchApp(env, data);
  page = await app.firstWindow();
  await expect(shown(page)).toHaveAccessibleName(/Release notes draft/);
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab", { name: "Release notes draft" })).toHaveAttribute("aria-selected", "true");
  await expect(terminalPick(page)).toBeChecked();
  await page.getByRole("radiogroup", { name: "Chat or Terminal" }).getByRole("radio", { name: "Chat" }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Release notes draft" })).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `restart-shown-${scheme}.png`) });
  }
  // A stored agent that hc no longer lists: the first agent of the list shows.
  await page.evaluate(() => localStorage.setItem("tabs.shown", "t99"));
  await app.close();

  app = await launchApp(env, data);
  page = await app.firstWindow();
  await expect(shown(page)).toHaveAccessibleName(/Chat panel usability audit/);
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  await app.close();
});

test("the window has a minimum size of 640 x 480", async () => {
  const app = await launchApp({ ...env, CONTR_TERMINAL: "t7" });
  const page = await app.firstWindow();
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getMinimumSize())).toEqual([640, 480]);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(640, 480));
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([640, 480]);
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `min-size-640x480-${scheme}.png`) });
  }
  await app.close();
});
