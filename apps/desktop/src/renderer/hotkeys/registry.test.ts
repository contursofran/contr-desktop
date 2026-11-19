// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/hotkeys/registry.test.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.
import { describe, expect, it } from "vitest";
import { hotkey } from "./registry";

describe("HOTKEYS_REGISTRY", () => {
  it("resolves the New Terminal command to its macOS chord", () => {
    expect(hotkey("NEW_TERMINAL", "darwin")).toBe("meta+t");
  });

  it.each(["win32", "linux", "freebsd"])("leaves New Terminal unbound on %s", (platform) => {
    expect(hotkey("NEW_TERMINAL", platform)).toBeUndefined();
  });
});
