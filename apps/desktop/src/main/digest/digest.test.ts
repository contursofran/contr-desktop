import { describe, expect, it } from "vitest";
import type { FeedRow } from "../../shared/api";
import { countBusy, countFailing, countWaiting, mergedArgs, OwnerTimes } from "./digest";

const row = (k: string, ts?: number): FeedRow => ({ id: `${k}${ts}`, k, ts });

describe("OwnerTimes", () => {
  it("gives the owner message before the last one", () => {
    const t = new OwnerTimes();
    expect(t.leftAt()).toBeNull();
    t.splice(0, [row("user", 100), row("assistant", 110)]);
    expect(t.leftAt()).toBe(100);
    t.splice(2, [row("user", 200), row("assistant", 210)]);
    expect(t.leftAt()).toBe(100);
    t.splice(4, [row("user", 300)]);
    expect(t.leftAt()).toBe(200);
  });
  it("replaces the rows from the splice's place", () => {
    const t = new OwnerTimes();
    t.splice(0, [row("user", 100), row("user", 200), row("user", 300)]);
    t.splice(1, [row("assistant", 400)]);
    expect(t.leftAt()).toBe(100);
  });
});

describe("digest counts", () => {
  const workers = JSON.stringify([
    { name: "b-1", parent: "t7", live: true, status: "working" },
    { name: "b-2", parent: "t7", live: true, status: "blocked" },
    { name: "b-3", parent: "t7", live: false, status: "working" },
    { name: "b-4", parent: "t12", live: true, status: "working" },
    { name: "b-5", parent: "t7", live: true, status: "working" },
  ]);
  it("counts the live working workers of the coordinator", () => {
    expect(countBusy(workers, "t7")).toBe(2);
    expect(countBusy("[]", "t7")).toBe(0);
    expect(countBusy("not json", "t7")).toBeNull();
  });
  it("counts the open owner items of the coordinator", () => {
    const open = JSON.stringify([
      { id: "D1", coordinator: "hc:t7", question: "Block or row?" },
      { id: "T1", kind: "todo", coordinator: "t7", text: "Run e2e" },
      { id: "D2", coordinator: "t12", question: "Other?" },
    ]);
    expect(countWaiting(open, "t7")).toBe(2);
    expect(countWaiting("{}", "t7")).toBeNull();
  });
  it("counts the open PRs with a failed check", () => {
    const prs = JSON.stringify([
      { number: 1, statusCheckRollup: [{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }] },
      { number: 2, statusCheckRollup: [{ conclusion: "SUCCESS" }] },
      { number: 3, statusCheckRollup: [{ state: "ERROR" }] },
      { number: 4, statusCheckRollup: [{ status: "IN_PROGRESS", conclusion: "" }] },
      { number: 5, statusCheckRollup: [] },
    ]);
    expect(countFailing(prs)).toBe(2);
    expect(countFailing("")).toBeNull();
  });
  it("searches the merges from the time, in UTC", () => {
    expect(mergedArgs(Date.UTC(2026, 10, 18, 14, 2, 30, 500))).toContain("merged:>=2026-11-18T14:02:30Z");
  });
});
