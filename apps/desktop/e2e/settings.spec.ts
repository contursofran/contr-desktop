import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const env = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

test("Settings reads the helper path and saves the native theme over a restart", async () => {
  test.setTimeout(90_000);
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  let app = await launchApp(env, data);
  const page = await app.firstWindow();
  const button = page.locator("aside > footer").getByRole("button", { name: "Settings" });
  await button.click();
  const view = page.getByRole("region", { name: "Settings" });
  const theme = view.getByRole("radiogroup", { name: "Theme" });
  await expect(view.getByLabel("Helper path")).toHaveText(env.CONTR_HELPER);
  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(theme.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");

  await theme.getByRole("radio", { name: "Light" }).click();
  await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await app.close();

  // The choice is kept: a new launch starts light.
  app = await launchApp(env, data);
  const restarted = await app.firstWindow();
  await expect(restarted.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await app.close();
});
