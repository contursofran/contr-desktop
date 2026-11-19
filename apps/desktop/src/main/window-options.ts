import type { BrowserWindowConstructorOptions, Rectangle } from "electron";

/** The window fill `--win` of the contr design system (src/renderer/tokens.css), dark and light. */
export const CANVAS_DARK = "#141518";
export const CANVAS_LIGHT = "#eff0f2";

/** Below about 604 px the reply box's model button breaks onto two lines; 640 keeps a margin. 480 as herdr-contr-mac. */
export const MIN_WIDTH = 640;
export const MIN_HEIGHT = 480;

export function startupWindowBounds(workArea: Rectangle) {
  const minWidth = Math.min(MIN_WIDTH, workArea.width);
  const minHeight = Math.min(MIN_HEIGHT, workArea.height);
  const width = Math.max(minWidth, Math.round(workArea.width * 0.9));
  const height = Math.max(minHeight, Math.round(workArea.height * 0.9));

  return {
    x: workArea.x + Math.floor((workArea.width - width) / 2),
    y: workArea.y + Math.floor((workArea.height - height) / 2),
    width,
    height,
    minWidth,
    minHeight,
  };
}

export function windowOptions(
  platform: NodeJS.Platform,
  preload: string,
  hidden = false,
  workArea?: Rectangle,
): BrowserWindowConstructorOptions {
  const bounds = !hidden && workArea
    ? startupWindowBounds(workArea)
    : { width: 1200, height: 800, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT };
  return {
    ...bounds,
    show: false,
    backgroundColor: CANVAS_DARK,
    titleBarStyle: platform === "darwin" ? "hiddenInset" : "hidden",
    // A hidden window (e2e) still paints and runs timers, so screenshots and spinners work.
    webPreferences: { preload, contextIsolation: true, sandbox: true, ...(hidden && { backgroundThrottling: false }) },
  };
}
