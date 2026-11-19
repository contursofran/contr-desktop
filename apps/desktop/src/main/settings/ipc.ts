import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import { homedir } from "node:os";
import path from "node:path";
import { CODEX_HEALTH_CHANNEL, SETTINGS_CHANNEL, THEME_CHANNEL, type ThemeChoice } from "../../shared/api";
import { helperPath } from "../helper/run";
import { CANVAS_DARK, CANVAS_LIGHT } from "../window-options";
import { readCodexHealth } from "./codex-health";
import { readTheme, writeTheme } from "./theme";

const CANVAS = { dark: CANVAS_DARK, light: CANVAS_LIGHT };

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
  ipcMain.handle(CODEX_HEALTH_CHANNEL, () => {
    const home = process.env.CONTR_E2E === "1" ? app.getPath("userData") : homedir();
    return readCodexHealth(process.env.CODEX_HOME || path.join(home, ".codex"));
  });
  ipcMain.handle(THEME_CHANNEL, (_e, theme: ThemeChoice) => {
    nativeTheme.themeSource = writeTheme(file, theme);
    paint();
    return theme;
  });
}
