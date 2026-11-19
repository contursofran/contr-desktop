import { describe, expect, it } from "vitest";
import { CANVAS_DARK, MIN_HEIGHT, MIN_WIDTH, startupWindowBounds, windowOptions } from "./window-options";

describe("startupWindowBounds", () => {
  it("centers the window at 90% of an offset work area", () => {
    expect(startupWindowBounds({ x: -1921, y: 25, width: 1921, height: 1055 })).toEqual({
      x: -1825, y: 77, width: 1729, height: 950, minWidth: 640, minHeight: 480,
    });
  });

  it("uses the minimum size when 90% of the work area is smaller", () => {
    expect(startupWindowBounds({ x: 0, y: 24, width: 680, height: 520 })).toEqual({
      x: 20, y: 44, width: 640, height: 480, minWidth: 640, minHeight: 480,
    });
  });

  it("fits inside a work area smaller than the minimum", () => {
    expect(startupWindowBounds({ x: 1280, y: 24, width: 600, height: 400 })).toEqual({
      x: 1280, y: 24, width: 600, height: 400, minWidth: 600, minHeight: 400,
    });
  });
});

describe("windowOptions", () => {
  it("uses hiddenInset on macOS", () => {
    expect(windowOptions("darwin", "p").titleBarStyle).toBe("hiddenInset");
  });
  it("uses hidden on other platforms", () => {
    expect(windowOptions("linux", "p").titleBarStyle).toBe("hidden");
    expect(windowOptions("win32", "p").titleBarStyle).toBe("hidden");
  });
  it("paints the dark canvas before the page loads", () => {
    expect(windowOptions("darwin", "p").backgroundColor).toBe(CANVAS_DARK);
    expect(CANVAS_DARK).toBe("#141518");
  });
  it("has a minimum size of 640 x 480", () => {
    const o = windowOptions("darwin", "p");
    expect([o.minWidth, o.minHeight]).toEqual([MIN_WIDTH, MIN_HEIGHT]);
    expect([MIN_WIDTH, MIN_HEIGHT]).toEqual([640, 480]);
  });
  it("applies the startup bounds to a normal window", () => {
    const workArea = { x: 0, y: 24, width: 1600, height: 1000 };
    expect(windowOptions("darwin", "p", false, workArea)).toMatchObject(startupWindowBounds(workArea));
  });
  it("keeps the hidden e2e window at 1200 x 800", () => {
    const o = windowOptions("darwin", "p", true, { x: 0, y: 24, width: 600, height: 400 });
    expect(o).toMatchObject({ width: 1200, height: 800, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, show: false });
    expect(o).not.toHaveProperty("x");
    expect(o).not.toHaveProperty("y");
  });
});
