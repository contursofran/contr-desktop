import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { faviconUrl, findFavicon, parseCounts } from "./git";

describe("findFavicon", () => {
  it("takes the first file in the design's order and skips .ico", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-fav-"));
    expect(findFavicon(dir)).toBeNull();
    writeFileSync(path.join(dir, "favicon.ico"), "");
    mkdirSync(path.join(dir, "public"));
    writeFileSync(path.join(dir, "public", "icon.png"), "");
    expect(findFavicon(dir)).toBe(path.join(dir, "public", "icon.png"));
    writeFileSync(path.join(dir, "public", "favicon.png"), "");
    expect(findFavicon(dir)).toBe(path.join(dir, "public", "favicon.png"));
    writeFileSync(path.join(dir, "favicon.svg"), "");
    expect(faviconUrl(dir)).toBe(`contr-image://local${path.join(dir, "favicon.svg")}`);
  });
  it("gives null with no folder", () => expect(findFavicon("")).toBeNull());
});

describe("parseCounts", () => {
  it("reads ahead and behind", () => expect(parseCounts("2\t4\n")).toEqual({ ahead: 2, behind: 4 }));
  it("gives 0 0 with no upstream", () => expect(parseCounts("")).toEqual({ ahead: 0, behind: 0 }));
});
