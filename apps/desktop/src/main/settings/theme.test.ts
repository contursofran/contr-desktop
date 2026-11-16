import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readTheme, writeTheme } from "./theme";

const file = () => path.join(mkdtempSync(path.join(os.tmpdir(), "contr-settings-")), "settings.json");

describe("theme setting", () => {
  it("is system when there is no file", () => expect(readTheme(file())).toBe("system"));
  it("is system when the file is bad or the value unknown", () => {
    const f = file();
    writeFileSync(f, "{");
    expect(readTheme(f)).toBe("system");
    writeFileSync(f, '{"theme":"blue"}');
    expect(readTheme(f)).toBe("system");
  });
  it("keeps the choice and the other keys", () => {
    const f = file();
    writeFileSync(f, '{"x":1}');
    writeTheme(f, "light");
    expect(readTheme(f)).toBe("light");
    expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ x: 1, theme: "light" });
  });
  it("rejects an unknown choice", () => expect(() => writeTheme(file(), "blue")).toThrow("unknown theme"));
});
