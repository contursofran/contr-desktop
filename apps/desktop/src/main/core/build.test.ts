import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coreOrder, parseStamp, readBundleTag, readInstalled, stampOfTag } from "./build";

describe("core builds", () => {
  it("reads a tag and a stamp", () => {
    expect(stampOfTag("build-2026-11-17-57ec8f6\n")).toEqual({ sha: "57ec8f6", date: "2026-11-17" });
    expect(parseStamp("57ec8f6 2026-11-17")).toEqual({ sha: "57ec8f6", date: "2026-11-17" });
  });
  it("orders by sha, then by date", () => {
    const bundle = { sha: "aaaaaaa", date: "2026-11-17" };
    expect(coreOrder(bundle, { sha: "aaaaaaa", date: "2026-11-17" })).toBe("same");
    expect(coreOrder(bundle, { sha: "bbbbbbb", date: "2026-11-16" })).toBe("older");
    expect(coreOrder(bundle, { sha: "bbbbbbb", date: "2026-11-18" })).toBe("newer");
  });
  it("the same date and another sha is unknown", () => {
    expect(coreOrder({ sha: "aaaaaaa", date: "2026-11-17" }, { sha: "bbbbbbb", date: "2026-11-17" })).toBe("unknown");
  });
  it("a bad tag or stamp is null and gives unknown", () => {
    for (const tag of ["build-2026-11-16-abc123", "v0.8.0", "build-2026-11-16-zzzzzzz", "", null]) expect(stampOfTag(tag)).toBeNull();
    for (const stamp of ["unknown", "57ec8f6", "57ec8f6 2026-11-17 x", "57ec8f 2026-11-17", null]) expect(parseStamp(stamp)).toBeNull();
    expect(coreOrder(null, { sha: "aaaaaaa", date: "2026-11-17" })).toBe("unknown");
    expect(coreOrder({ sha: "aaaaaaa", date: "2026-11-17" }, null)).toBe("unknown");
  });
  it("reads RELEASE and install.json, and null when they are missing or bad", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-core-test-"));
    expect(readBundleTag(dir)).toBeNull();
    expect(readInstalled(dir)).toBeNull();
    writeFileSync(path.join(dir, "RELEASE"), "build-2026-11-17-57ec8f6\n");
    writeFileSync(path.join(dir, "install.json"), JSON.stringify({ build: "57ec8f6 2026-11-17", files: { a: "x", b: "y" } }));
    expect(readBundleTag(dir)).toBe("build-2026-11-17-57ec8f6");
    expect(readInstalled(dir)).toEqual({ build: "57ec8f6 2026-11-17", modFiles: 2 });
    writeFileSync(path.join(dir, "install.json"), "{");
    expect(readInstalled(dir)).toBeNull();
  });
});
