import { describe, expect, it } from "vitest";
import { checksQuery, readChecks, readRoles, readWorkers } from "./board";

describe("readWorkers", () => {
  it("maps the tool's status to a mark, and keeps the live entry of a name", () => {
    const json = JSON.stringify([
      { name: "a", live: true, status: "working" },
      { name: "b", live: true, status: "blocked" },
      { name: "c", live: true, status: "idle" },
      { name: "d", live: false },
      { name: "e", live: true, status: "working" },
      { name: "e", live: false },
      { name: "f", live: false },
      { name: "f", live: true, status: "idle" },
    ]);
    expect(readWorkers(json)).toEqual({ a: "working", b: "blocked", c: "idle", d: "done", e: "working", f: "idle" });
  });
  it("matches a name under the agent's parent, and falls back to the name only", () => {
    const json = JSON.stringify([
      { name: "b-10", parent: "t9", live: true, status: "blocked" },
      { name: "b-10", parent: "t1", live: true, status: "working" },
      { name: "b-20", parent: "t9", live: true, status: "idle" },
    ]);
    expect(readWorkers(json, "t1")).toEqual({ "b-10": "working", "b-20": "idle" });
    expect(readWorkers(json, "t9")).toEqual({ "b-10": "blocked", "b-20": "idle" });
  });
  it("gives no workers when the tool fails", () => {
    expect(readWorkers("")).toEqual({});
    expect(readWorkers('{"x":1}')).toEqual({});
  });
});

describe("checks", () => {
  it("asks for all issues in one query", () => {
    const q = checksQuery([3, 4]);
    expect(q).toContain("n3: issue(number: 3)");
    expect(q).toContain("n4: issue(number: 4)");
  });
  it("reads each issue's PR and its checks", () => {
    const pr = (number: number, state: string | null) => ({
      closedByPullRequestsReferences: { nodes: [{ number, commits: { nodes: [{ commit: { statusCheckRollup: state && { state } } }] } }] },
    });
    const json = JSON.stringify({
      data: { repository: { n1: pr(11, "SUCCESS"), n2: pr(12, "PENDING"), n3: pr(13, "FAILURE"), n4: pr(14, null), n5: { closedByPullRequestsReferences: { nodes: [] } }, n6: null } },
    });
    const out = readChecks(json, [1, 2, 3, 4, 5, 6, 7]);
    expect(Object.fromEntries(out)).toEqual({
      1: { pr: 11, checks: "pass" },
      2: { pr: 12, checks: "pending" },
      3: { pr: 13, checks: "fail" },
      4: { pr: 14, checks: null },
      5: null,
      6: null,
      7: null,
    });
    expect(readChecks("not json", [1]).get(1)).toBeNull();
  });
});

describe("readRoles", () => {
  it("gives the role of the entry that readWorkers takes", () => {
    const json = JSON.stringify([
      { name: "b-10", parent: "t9", live: true, role: "planner" },
      { name: "b-10", parent: "t1", live: true, role: "builder-medium" },
      { name: "r-10", parent: "t1", live: true, role: "reviewer" },
      { name: "x", parent: "t1", live: true },
    ]);
    expect(readRoles(json, "t1")).toEqual({ "b-10": "builder-medium", "r-10": "reviewer" });
    expect(readRoles(json, "t9")).toEqual({ "b-10": "planner", "r-10": "reviewer" });
    expect(readRoles("")).toEqual({});
  });
});
