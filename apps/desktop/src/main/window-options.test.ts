import { describe, expect, it } from "vitest";
import { CANVAS_DARK, windowOptions } from "./window-options";

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
    expect(CANVAS_DARK).toBe("#202020");
  });
});
