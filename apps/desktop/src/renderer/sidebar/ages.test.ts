import { describe, expect, it } from "vitest";
import type { SidebarAgent } from "../../shared/api";
import { duration, tip, track } from "./ages";

const agent = (terminal: string, state: SidebarAgent["state"], more: Partial<SidebarAgent> = {}): SidebarAgent => ({
  terminal, title: terminal, name: null, state, kind: null, issue: null, workers: [], ...more,
});

describe("track", () => {
  it("stamps a first sight and a change, keeps an unchanged one, and counts done and idle as one", () => {
    const prev = { t1: { s: "working" as const, at: 1 }, t2: { s: "idle" as const, at: 2 }, t3: { s: "working" as const, at: 3 } };
    const out = track(prev, [agent("t1", "working"), agent("t2", "done", { workers: [agent("t4", "blocked")] }), agent("t3", "blocked")], 100);
    expect(out).toEqual({ t1: { s: "working", at: 1 }, t2: { s: "idle", at: 2 }, t3: { s: "blocked", at: 100 }, t4: { s: "blocked", at: 100 } });
  });

  it("keeps a gone agent for 30 days only", () => {
    const day = 86_400_000;
    const out = track({ old: { s: "idle", at: 0 }, new: { s: "idle", at: 10 * day } }, [], 31 * day);
    expect(out).toEqual({ new: { s: "idle", at: 10 * day } });
  });
});

describe("duration", () => {
  it("gives minutes, hours and days", () => {
    expect([30_000, 5 * 60_000, 3 * 3_600_000, 2 * 86_400_000].map(duration)).toEqual(["<1m", "5m", "3h", "2d"]);
  });
});

describe("tip", () => {
  it("joins the known parts, and gives none for the name alone", () => {
    expect(tip(agent("t8", "working", { name: "b-30", issue: "30", title: "Flow diagrams" }))).toBe("b-30 · #30 · Flow diagrams");
    expect(tip(agent("t8", "working", { name: "b-30", title: "Flow diagrams" }))).toBe("b-30 · Flow diagrams");
    expect(tip(agent("t8", "working", { name: "b-30", title: "b-30" }))).toBe("");
  });
});
