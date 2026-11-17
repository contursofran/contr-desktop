import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import { SETTINGS_CHANNEL, THEME_CHANNEL, type ThemeChoice } from "../../shared/api";
import { helperPath } from "../helper/run";
import { readTheme, writeTheme } from "./theme";

const CANVAS = { dark: "#202020", light: "#ffffff" };

/** Paints each window's background in the shown theme, so no other color shows on resize. */
function paint(): void {
  const color = nativeTheme.shouldUseDarkColors ? CANVAS.dark : CANVAS.light;
  for (const w of BrowserWindow.getAllWindows()) w.setBackgroundColor(color);
}

/** The Settings view: the theme choice (nativeTheme follows macOS on "system") and the helper path. */
export function registerSettingsIpc(appRoot: string): void {
  const file = path.join(app.getPath("userData"), "settings.json");
  nativeTheme.themeSource = readTheme(file);
  nativeTheme.on("updated", paint);
  // The window sets its options' backgroundColor after this event, so the paint comes on the next turn.
  app.on("browser-window-created", (_e, w) => setImmediate(() => w.setBackgroundColor(nativeTheme.shouldUseDarkColors ? CANVAS.dark : CANVAS.light)));
  ipcMain.handle(SETTINGS_CHANNEL, () => ({ theme: readTheme(file), helper: helperPath(appRoot) }));
  ipcMain.handle(THEME_CHANNEL, (_e, theme: ThemeChoice) => {
    nativeTheme.themeSource = writeTheme(file, theme);
    paint();
    return theme;
  });
}
