import { describe, expect, it, vi } from "vitest";
import type { HelperLine } from "../helper/run";
import { checkView, NO_GH, readUpdateLine, runCoreCheck } from "./check";

const header: HelperLine = { type: "header", protocol: 1 };
const end: HelperLine = { type: "end", ok: true };
const update = (more: object = {}): HelperLine => ({
  type: "update",
  installed: "bbbbbbb 2026-11-10",
  newest: "ccccccc 2026-11-17",
  tag: "build-2026-11-17-ccccccc",
  url: "u",
  differs: true,
  checked_at: 100,
  ...more,
});

describe("readUpdateLine", () => {
  it("no-gh and gh give the gh text", () => {
    for (const code of ["no-gh", "gh"]) expect(readUpdateLine([header, { type: "error", code, message: "x" }, end])).toEqual({ error: NO_GH });
    expect(readUpdateLine([header, { type: "error", code: "check", message: "bad digest" }, end])).toEqual({ error: "bad digest" });
  });
  it("versions and newer win over stamps and differs", () => {
    const read = readUpdateLine([header, update({ installed_version: "0.1.41", newest_version: "0.1.57", newer: false }), end]);
    expect("error" in read).toBe(false);
    expect(checkView(read as Exclude<typeof read, { error: string }>)).toEqual({ current: "0.1.41", latest: "0.1.57", available: false });
  });
  it("with no C2 fields the stamps and differs count", () => {
    const read = readUpdateLine([header, update(), end]);
    expect(checkView(read as Exclude<typeof read, { error: string }>)).toEqual({ current: "bbbbbbb 2026-11-10", latest: "ccccccc 2026-11-17", available: true });
  });
  it("no update line is an error", () => {
    expect(readUpdateLine([header, end])).toEqual({ error: "the helper gave no update line" });
  });
});

describe("runCoreCheck", () => {
  it("Check now passes --force, the start does not", async () => {
    const run = vi.fn(async () => [header, update(), end]);
    await runCoreCheck("/h", "/tmp/core", false, run, {});
    await runCoreCheck("/h", "/tmp/core", true, run, {});
    expect(run.mock.calls).toEqual([
      ["/h", ["update", "check"], { env: { CONTR_HOME: "/tmp/core" } }],
      ["/h", ["update", "check", "--force"], { env: { CONTR_HOME: "/tmp/core" } }],
    ]);
  });
});
