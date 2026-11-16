import { describe, expect, it } from "vitest";
import { terminalTheme } from "./theme";

describe("terminalTheme", () => {
  it("takes the dark theme file's terminal keys", () => {
    const t = terminalTheme("dark");
    expect(t).toMatchObject({ background: "#202020", foreground: "#dedede", cursor: "#dedede", selectionBackground: "#3a4a63" });
    expect([t.black, t.red, t.blue, t.white]).toEqual(["#2a2a2a", "#ff6961", "#0a84ff", "#dedede"]);
    expect([t.brightBlack, t.brightBlue, t.brightWhite]).toEqual(["#6a6a6a", "#409cff", "#ffffff"]);
  });
  it("takes the light theme file's terminal keys", () => {
    const t = terminalTheme("light");
    expect(t).toMatchObject({ background: "#ececec", foreground: "#1d1d1f", cursor: "#1d1d1f", selectionBackground: "#b3d4ff" });
    expect([t.black, t.red, t.white]).toEqual(["#1d1d1f", "#d70015", "#c7c7cc"]);
    expect([t.brightRed, t.brightCyan, t.brightWhite]).toEqual(["#ff3b30", "#32ade6", "#f5f5f7"]);
  });
});
