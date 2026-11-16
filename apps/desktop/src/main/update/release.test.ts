import { describe, expect, it } from "vitest";
import { newer, parseRelease } from "./release";

const asset = (name: string) => ({ name, browser_download_url: `https://x/${name}` });

describe("parseRelease", () => {
  it("reads the version from the notes and the .dmg url", () => {
    expect(parseRelease({ name: "build-2026-11-16-abc1234", body: "contr 0.1.12 from abc.", assets: [asset("contr-mac-universal.zip"), asset("contr-mac-universal.dmg")] })).toEqual({ version: "0.1.12", dmgUrl: "https://x/contr-mac-universal.dmg" });
  });
  it("falls back to the name and gives no url with no .dmg", () => {
    expect(parseRelease({ name: "contr 1.2.3", assets: [] })).toEqual({ version: "1.2.3", dmgUrl: null });
  });
  it("throws with no version", () => expect(() => parseRelease({ body: "notes" })).toThrow("no version"));
});

describe("newer", () => {
  it("compares each part as a number", () => {
    expect(newer("0.1.10", "0.1.9")).toBe(true);
    expect(newer("0.1.9", "0.1.10")).toBe(false);
    expect(newer("0.1.9", "0.1.9")).toBe(false);
    expect(newer("1.0.0", "0.9.9")).toBe(true);
  });
});
