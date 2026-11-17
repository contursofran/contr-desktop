import type { BrowserWindowConstructorOptions } from "electron";

/** The design's dark canvas (docs/design/README.md, Colors). */
export const CANVAS_DARK = "#202020";

/** Below about 604 px the reply box's model button breaks onto two lines; 640 keeps a margin. 480 as herdr-contr-mac. */
export const MIN_WIDTH = 640;
export const MIN_HEIGHT = 480;

export function windowOptions(
  platform: NodeJS.Platform,
  preload: string,
  hidden = false,
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    // The smallest size where the top bar, the sidebar and the reply box keep their layout (docs/decisions, restart-state).
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: CANVAS_DARK,
    titleBarStyle: platform === "darwin" ? "hiddenInset" : "hidden",
    // A hidden window (e2e) still paints and runs timers, so screenshots and spinners work.
    webPreferences: { preload, contextIsolation: true, sandbox: true, ...(hidden && { backgroundThrottling: false }) },
  };
}
