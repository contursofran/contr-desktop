import type { BrowserWindowConstructorOptions } from "electron";

/** The design's dark canvas (docs/design/README.md, Colors). */
export const CANVAS_DARK = "#202020";

export function windowOptions(
  platform: NodeJS.Platform,
  preload: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: CANVAS_DARK,
    titleBarStyle: platform === "darwin" ? "hiddenInset" : "hidden",
    webPreferences: { preload, contextIsolation: true, sandbox: true },
  };
}
