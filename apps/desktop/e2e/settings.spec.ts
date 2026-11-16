import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const env = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};
const canvas = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("Settings opens from the foot, sets the theme from the tokens, and keeps it", async () => {
  test.setTimeout(90_000);
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  let app = await launchApp(env, data);
  let page = await app.firstWindow();
  // Playwright emulates no color scheme here: the page follows nativeTheme.
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await page.screenshot({ path: path.join(shots, "settings-chat-system.png") });

  const button = page.locator("aside > footer").getByRole("button", { name: "Settings" });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const view = page.getByRole("region", { name: "Settings" });
  const theme = view.getByRole("radiogroup", { name: "Theme" });
  await expect(theme.getByRole("radio")).toHaveText(["System", "Dark", "Light"]);
  await expect(theme.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await expect(view.getByLabel("Helper path")).toHaveText(env.CONTR_HELPER);

  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(theme.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => canvas(page)).toBe("rgb(32, 32, 32)");
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");
  await page.screenshot({ path: path.join(shots, "settings-dark.png") });

  await theme.getByRole("radio", { name: "Light" }).click();
  await expect.poll(() => canvas(page)).toBe("rgb(255, 255, 255)");
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await page.screenshot({ path: path.join(shots, "settings-light.png") });
  await app.close();

  // The choice is kept: a new launch starts light.
  app = await launchApp(env, data);
  page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await expect.poll(() => canvas(page)).toBe("rgb(255, 255, 255)");
  await expect(page.getByText("Run it with:")).toBeVisible();
  await page.screenshot({ path: path.join(shots, "settings-chat-light.png") });
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect.poll(() => canvas(page)).toBe("rgb(32, 32, 32)");
  await page.getByRole("region", { name: "contr-desktop" }).getByRole("button", { name: /Chat panel usability audit/ }).click();
  await expect(page.getByRole("region", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByText("Run it with:")).toBeVisible();
  await page.screenshot({ path: path.join(shots, "settings-chat-dark.png") });
  await app.close();
});
