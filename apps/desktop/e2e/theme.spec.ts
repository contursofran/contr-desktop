import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
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
};

// A hidden window's `prefers-color-scheme` does not follow macOS (#119), so this test reads the main process:
// nativeTheme.themeSource, and the window background that main paints for each choice.
const main = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow, nativeTheme }) => ({
    source: nativeTheme.themeSource,
    dark: nativeTheme.shouldUseDarkColors,
    background: BrowserWindow.getAllWindows()[0]!.getBackgroundColor().toLowerCase(),
  }));
const background = (dark: boolean) => (dark ? "#202020" : "#ffffff");

async function themeChoice(page: Page) {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" }).getByRole("radiogroup", { name: "Theme" });
}

test("each theme choice sets nativeTheme and the window background; System goes back to macOS and is kept", async () => {
  test.setTimeout(90_000);
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  let app = await launchApp(env, data);
  let page = await app.firstWindow();
  let theme = await themeChoice(page);
  await expect(theme.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  const system = await main(app);
  expect(system).toMatchObject({ source: "system", background: background(system.dark) });

  for (const [name, source, dark] of [["Light", "light", false], ["Dark", "dark", true]] as const) {
    await theme.getByRole("radio", { name }).click();
    await expect(theme.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => main(app)).toEqual({ source, dark, background: background(dark) });
  }
  await app.close();

  // Dark is kept over a restart; then System gives the choice back to macOS.
  app = await launchApp(env, data);
  page = await app.firstWindow();
  expect(await main(app)).toEqual({ source: "dark", dark: true, background: background(true) });
  theme = await themeChoice(page);
  await expect(theme.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await theme.getByRole("radio", { name: "System" }).click();
  await expect(theme.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => main(app)).toEqual(system);
  await app.close();

  // System is kept over a restart too.
  app = await launchApp(env, data);
  page = await app.firstWindow();
  expect(await main(app)).toEqual(system);
  theme = await themeChoice(page);
  await expect(theme.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await app.close();
});
