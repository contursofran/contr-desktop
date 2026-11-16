import type { BrowserWindowConstructorOptions } from "electron";

/** The design's dark canvas (docs/design/README.md, Colors). */
export const CANVAS_DARK = "#202020";

export function windowOptions(
  platform: NodeJS.Platform,
  preload: string,
  hidden = false,
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: CANVAS_DARK,
    titleBarStyle: platform === "darwin" ? "hiddenInset" : "hidden",
    // A hidden window (e2e) still paints and runs timers, so screenshots and spinners work.
    webPreferences: { preload, contextIsolation: true, sandbox: true, ...(hidden && { backgroundThrottling: false }) },
  };
}
