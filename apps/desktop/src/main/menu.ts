import { BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import { CLOSE_TAB_EVENT, OPEN_SETTINGS_EVENT } from "../shared/api";
import { HOTKEYS_REGISTRY } from "../shared/hotkeys";

/** The id of the app menu's "Check for Updates…" item (e2e clicks it through the main process). */
export const CHECK_UPDATES_ID = "check-updates";

export function fileMenu(): MenuItemConstructorOptions {
  return {
    role: "fileMenu",
    submenu: [
      {
        id: "close-tab",
        label: "Close Tab",
        accelerator: HOTKEYS_REGISTRY.CLOSE_TAB.accelerator,
        click: (_item, window) => {
          if (window instanceof BrowserWindow) window.webContents.send(CLOSE_TAB_EVENT);
        },
      },
      { role: "close", label: "Close Window", accelerator: "Shift+Command+W" },
    ],
  };
}

/**
 * The macOS menu follows Electron's default roles with two changes: Check for Updates in the app menu
 * and Close Tab in the File menu. With CONTR_E2E=1, the update check does not show or focus the window.
 * Other platforms keep Electron's default menu.
 */
export function setAppMenu(check: () => Promise<void>, e2e: boolean): void {
  if (process.platform !== "darwin") return;
  const checkUpdates = () => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send(OPEN_SETTINGS_EVENT);
      if (!e2e) w.show();
    }
    void check();
  };
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        role: "appMenu",
        submenu: [
          { role: "about" },
          { id: CHECK_UPDATES_ID, label: "Check for Updates…", click: checkUpdates },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      fileMenu(),
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}
