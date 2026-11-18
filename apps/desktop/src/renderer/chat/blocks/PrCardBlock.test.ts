import { describe, expect, it } from "vitest";
import type { PrCheck } from "../../../shared/api";
import { checkTime, duration, mergeText, reviewText } from "./PrCardBlock";
import { parsePr } from "./parse";

const check = (state: PrCheck["state"], startedAt: number | null, completedAt: number | null): PrCheck => ({ name: "e2e", state, startedAt, completedAt });

describe("PR card", () => {
  it("parses one PR number", () => {
    expect(parsePr("#31\n")).toBe(31);
    expect(parsePr("31")).toBe(31);
    expect(parsePr("#31 #32")).toBeNull();
    expect(parsePr("")).toBeNull();
  });
  it("writes run times as the mock does", () => {
    expect(duration(38_000)).toBe("38s");
    expect(duration(64_000)).toBe("1m 04s");
    expect(duration(252_000)).toBe("4m 12s");
    expect(duration(3_720_000)).toBe("1h 02m");
  });
  it("gives the time of each check state", () => {
    expect(checkTime(check("pass", 0, 38_000), 0)).toBe("38s");
    expect(checkTime(check("fail", 0, 252_000), 0)).toBe("4m 12s");
    expect(checkTime(check("running", 0, null), 130_000)).toBe("running 2m");
    expect(checkTime(check("running", 0, null), 40_000)).toBe("running 40s");
    expect(checkTime(check("queued", null, null), 0)).toBe("queued");
    expect(checkTime(check("skipped", 0, 0), 0)).toBe("skipped");
  });
  it("writes the merge and review states", () => {
    expect(mergeText({ state: "merged", merge: "UNKNOWN", base: "main" })).toBe("merged ✓");
    expect(mergeText({ state: "closed", merge: null, base: "main" })).toBe("closed");
    expect(mergeText({ state: "open", merge: "BEHIND", base: "main" })).toBe("behind main");
    expect(mergeText({ state: "open", merge: "CLEAN", base: "main" })).toBe("ready");
    expect(mergeText({ state: "open", merge: null, base: "main" })).toBe("not known yet");
    expect(reviewText({ author: "r-31", state: "COMMENTED", sha: "a1c9e4f0b2" })).toBe("r-31, on a1c9e4f");
    expect(reviewText(null)).toBe("none");
  });
});
