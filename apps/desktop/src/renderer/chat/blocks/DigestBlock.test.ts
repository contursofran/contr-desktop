import { describe, expect, it } from "vitest";
import { digestCells, digestSpan } from "./DigestBlock";

describe("digestCells", () => {
  it("shows the counts in the mock's order, red only for items that wait for the owner", () => {
    const cells = digestCells({ since: 1, merged: 2, busy: 1, waiting: 2, failing: 0 });
    expect(cells.map((c) => [c.n, c.label, c.you])).toEqual([
      ["2", "PRs merged", false],
      ["1", "worker busy", false],
      ["2", "wait for you", true],
      ["0", "CI failures", false],
    ]);
  });
  it("shows a dash for a count that its source did not give, and no red at 0", () => {
    const cells = digestCells({ since: null, merged: null, busy: 0, waiting: 0, failing: 1 });
    expect(cells.map((c) => [c.n, c.label, c.you])).toEqual([
      ["—", "PRs merged", false],
      ["0", "workers busy", false],
      ["0", "wait for you", false],
      ["1", "CI failure", false],
    ]);
    expect(digestCells(null).every((c) => c.n === "—")).toBe(true);
  });
});

describe("digestSpan", () => {
  it("gives from and to in local hours and minutes", () => {
    const at = (h: number, m: number) => new Date(2026, 10, 18, h, m).getTime();
    expect(digestSpan(at(14, 2), at(15, 0))).toBe("14:02 → 15:00");
    expect(digestSpan(null, at(15, 0))).toBe("");
  });
});

describe("historical digest spans", () => {
  it("gives both local dates when a span crosses midnight", () => {
    const since = new Date(2026, 10, 18, 22, 2).getTime();
    const end = new Date(2026, 10, 19, 13, 55).getTime();
    expect(digestSpan(since, end)).toBe("Wed 18 Nov 22:02 → Thu 19 Nov 13:55");
  });

  it("gives both dates when only the year differs", () => {
    const since = new Date(2025, 10, 19, 22, 2).getTime();
    const end = new Date(2026, 10, 19, 13, 55).getTime();
    expect(digestSpan(since, end)).toBe("Wed 19 Nov 22:02 → Thu 19 Nov 13:55");
    expect(digestSpan(since, null)).toBe("");
  });
});
