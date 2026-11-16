import { BrowserWindow, Menu } from "electron";
import { OPEN_SETTINGS_EVENT } from "../shared/api";

/** The id of the app menu's "Check for Updates…" item (e2e clicks it through the main process). */
export const CHECK_UPDATES_ID = "check-updates";

/**
 * The macOS menu: Electron's default menus (by their roles), with "Check for Updates…" after About in the app menu.
 * The item shows the Settings view and runs the check. With CONTR_E2E=1 it does not show or focus the window.
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
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}
