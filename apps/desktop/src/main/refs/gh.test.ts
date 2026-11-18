import { describe, expect, it, vi } from "vitest";
import { readCwd, readRefs, RefCache, refsQuery, toChecks } from "./gh";

const answer = JSON.stringify({
  data: {
    repository: {
      n1: { __typename: "PullRequest", state: "OPEN", isDraft: false, url: "https://github.com/o/r/pull/1" },
      n2: { __typename: "PullRequest", state: "OPEN", isDraft: true, url: "u2" },
      n3: { __typename: "PullRequest", state: "MERGED", isDraft: false, url: "u3" },
      n4: { __typename: "PullRequest", state: "CLOSED", isDraft: false, url: "u4" },
      n5: { __typename: "Issue", state: "OPEN", stateReason: null, url: "u5" },
      n6: { __typename: "Issue", state: "CLOSED", stateReason: "COMPLETED", url: "u6" },
      n7: { __typename: "Issue", state: "CLOSED", stateReason: "NOT_PLANNED", url: "u7" },
      n8: null,
    },
  },
  errors: [{ type: "NOT_FOUND" }],
});

describe("gh refs", () => {
  it("asks for all numbers in one query", () => {
    const q = refsQuery([12, 14]);
    expect(q).toContain("n12: issueOrPullRequest(number: 12)");
    expect(q).toContain("n14: issueOrPullRequest(number: 14)");
    expect(q).toContain("repository(owner: $owner, name: $repo)");
  });

  it("reads each PR and issue state; unknown numbers are null", () => {
    const m = readRefs(answer, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(m.get(1)).toEqual({ kind: "pr", state: "open", url: "https://github.com/o/r/pull/1" });
    expect([2, 3, 4].map((n) => m.get(n)?.state)).toEqual(["draft", "merged", "closed"]);
    expect([5, 6, 7].map((n) => m.get(n))).toEqual([
      { kind: "issue", state: "open", url: "u5" },
      { kind: "issue", state: "closed", url: "u6" },
      { kind: "issue", state: "not-planned", url: "u7" },
    ]);
    expect(m.get(8)).toBeNull();
    expect(m.get(9)).toBeNull();
  });

  it("asks for the head's check rollup and its counts", () => {
    expect(refsQuery([12])).toContain("statusCheckRollup { state contexts { totalCount checkRunCountsByState");
  });

  it("reads a PR's checks: passed, failed and all, from check runs and status contexts", () => {
    const runs = (s: string, counts: Record<string, number>, total: number) => ({
      state: s,
      contexts: {
        totalCount: total,
        checkRunCountsByState: Object.entries(counts).map(([state, count]) => ({ state, count })),
        statusContextCountsByState: [{ state: "SUCCESS", count: 1 }, { state: "ERROR", count: 0 }],
      },
    });
    expect(toChecks(runs("SUCCESS", { SUCCESS: 4, SKIPPED: 1, NEUTRAL: 0 }, 6))).toEqual({ state: "pass", passed: 6, failed: 0, total: 6 });
    expect(toChecks(runs("PENDING", { SUCCESS: 3, IN_PROGRESS: 2 }, 6))).toEqual({ state: "pending", passed: 4, failed: 0, total: 6 });
    expect(toChecks(runs("FAILURE", { SUCCESS: 3, FAILURE: 1, TIMED_OUT: 1 }, 6))).toEqual({ state: "fail", passed: 4, failed: 2, total: 6 });
    expect(toChecks(runs("ERROR", {}, 1))?.state).toBe("fail");
    expect(toChecks(null)).toBeUndefined();
    const pr = { __typename: "PullRequest", state: "OPEN", isDraft: false, url: "u", commits: { nodes: [{ commit: { statusCheckRollup: runs("SUCCESS", { SUCCESS: 1 }, 2) } }] } };
    expect(readRefs(JSON.stringify({ data: { repository: { n1: pr } } }), [1]).get(1)).toEqual({ kind: "pr", state: "open", url: "u", checks: { state: "pass", passed: 2, failed: 0, total: 2 } });
  });

  it("gives null for all numbers when gh fails", () => {
    expect(readRefs("gh: not a repo", [1]).get(1)).toBeNull();
  });

  it("reads the foreground cwd, else the terminal's", () => {
    expect(readCwd(JSON.stringify({ cwd: "/a", foreground: { cwd: "/b" } }))).toBe("/b");
    expect(readCwd(JSON.stringify({ cwd: "/a" }))).toBe("/a");
    expect(readCwd("{}")).toBeNull();
    expect(readCwd("error")).toBeNull();
  });
});

describe("RefCache", () => {
  it("calls gh once per number per minute, batched", async () => {
    let now = 0;
    const fetch = vi.fn(async (numbers: number[]) => new Map(numbers.map((n) => [n, { kind: "pr" as const, state: "open" as const, url: `u${n}` }])));
    const cache = new RefCache(fetch, () => now);
    const [a, b] = await Promise.all([cache.get([1, 2, 2]), cache.get([2, 3])]);
    expect(a[1]?.url).toBe("u1");
    expect(b[3]?.url).toBe("u3");
    expect(fetch.mock.calls).toEqual([[[1, 2]], [[3]]]);
    now = 59_999;
    await cache.get([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(2);
    now = 60_000;
    await cache.get([1, 3, 4]);
    expect(fetch.mock.calls[2]).toEqual([[1, 3, 4]]);
  });
});
