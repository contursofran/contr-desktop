// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/hotkeys/registry.test.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.
import { describe, expect, it } from "vitest";
import { hotkey, resolveHotkey } from "./registry";

describe("HOTKEYS_REGISTRY", () => {
  it("resolves the New Terminal command to its macOS chord", () => {
    expect(hotkey("NEW_TERMINAL", "darwin")).toBe("meta+t");
  });

  it.each(["win32", "linux", "freebsd"])("leaves New Terminal unbound on %s", (platform) => {
    expect(hotkey("NEW_TERMINAL", platform)).toBeUndefined();
  });
});

describe("agent shortcuts", () => {
  const event = {
    key: "j", code: "KeyJ", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    defaultPrevented: false, isComposing: false, repeat: false,
  };

  it.each([
    ["TOGGLE_CHAT_TERMINAL", "meta+j", "j", false],
    ["PREVIOUS_AGENT", "meta+alt+arrowup", "ArrowUp", true],
    ["NEXT_AGENT", "meta+alt+arrowdown", "ArrowDown", true],
    ["CLOSE_TAB", "meta+w", "w", false],
  ] as const)("binds %s on macOS", (id, chord, key, altKey) => {
    expect(hotkey(id, "darwin")).toBe(chord);
    const shortcut = { ...event, key, code: "", altKey };
    expect(resolveHotkey(shortcut, "darwin")).toBe(id);
    expect(resolveHotkey({ ...shortcut, shiftKey: true }, "darwin")).toBeUndefined();
    for (const platform of ["win32", "linux", "freebsd"]) {
      expect(hotkey(id, platform)).toBeUndefined();
      expect(resolveHotkey(shortcut, platform)).toBeUndefined();
    }
  });

  it("uses the physical letter if a layout produces a non-Latin key", () => {
    const shortcut = { ...event, key: "ц", code: "KeyW" };
    expect(resolveHotkey(shortcut, "darwin")).toBe("CLOSE_TAB");
    expect(resolveHotkey({ ...shortcut, key: "j" }, "darwin")).toBe("TOGGLE_CHAT_TERMINAL");
  });

  it.each(["defaultPrevented", "isComposing", "repeat"] as const)("ignores %s events", (flag) => {
    expect(resolveHotkey({ ...event, [flag]: true }, "darwin")).toBeUndefined();
  });
});
