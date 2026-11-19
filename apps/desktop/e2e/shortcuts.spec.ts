import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { launchApp } from "./launch";

test("File > Close Tab sends the close command to the shown tab", async () => {
  test.skip(process.platform !== "darwin", "The custom File menu is on macOS.");
  const data = test.info().outputPath("profile");
  mkdirSync(data, { recursive: true });
  const app = await launchApp({ CONTR_TERMINAL: "t7", FAKE_HC_AGENTS: "1" }, data);
  try {
    const page = await app.firstWindow();
    const tabs = page.getByRole("tablist", { name: "Tabs" });
    await expect(tabs.getByRole("tab", { selected: true })).toHaveText("Chat panel usability audit");
    const closeTab = () => app.evaluate(({ BrowserWindow, Menu }) => {
      const window = BrowserWindow.getAllWindows()[0];
      Menu.getApplicationMenu()?.getMenuItemById("close-tab")?.click(undefined, window);
    });
    await closeTab();
    await expect(tabs.getByRole("tab")).toHaveCount(0);
    await closeTab();
    await expect(tabs.getByRole("button", { name: "New tab" })).toBeVisible();
    expect(app.windows()).toHaveLength(1);
  } finally {
    await app.close();
  }
});
