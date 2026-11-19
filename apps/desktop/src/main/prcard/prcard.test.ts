import { describe, expect, it } from "vitest";
import { findWorker, prViewArgs, readFailure, readPrView, toCheck } from "./prcard";

const T = (s: number) => new Date(Date.UTC(2026, 10, 18, 14, 0, s)).toISOString();
const ms = (s: number) => Date.UTC(2026, 10, 18, 14, 0, s);

describe("toCheck", () => {
  const run = (status: string, conclusion: string, started = T(0), completed = T(38)) => ({ __typename: "CheckRun", name: "Unit", status, conclusion, startedAt: started, completedAt: completed });
  it("reads each state of a check run", () => {
    expect(toCheck(run("COMPLETED", "SUCCESS"))).toEqual({ name: "Unit", state: "pass", startedAt: ms(0), completedAt: ms(38) });
    expect(toCheck(run("COMPLETED", "NEUTRAL")).state).toBe("pass");
    expect(toCheck(run("COMPLETED", "SKIPPED")).state).toBe("skipped");
    for (const c of ["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]) expect(toCheck(run("COMPLETED", c)).state).toBe("fail");
    expect(toCheck(run("IN_PROGRESS", "", T(0), "0001-01-01T00:00:00Z"))).toEqual({ name: "Unit", state: "running", startedAt: ms(0), completedAt: null });
    expect(toCheck(run("QUEUED", "", "0001-01-01T00:00:00Z", "0001-01-01T00:00:00Z"))).toEqual({ name: "Unit", state: "queued", startedAt: null, completedAt: null });
  });
  it("reads a status context", () => {
    expect(toCheck({ __typename: "StatusContext", context: "ci/old", state: "ERROR", startedAt: T(0) }).state).toBe("fail");
    expect(toCheck({ __typename: "StatusContext", context: "ci/old", state: "SUCCESS", startedAt: T(0) })).toMatchObject({ name: "ci/old", state: "pass" });
    expect(toCheck({ __typename: "StatusContext", context: "ci/old", state: "PENDING", startedAt: T(0) }).state).toBe("running");
  });
});

describe("readPrView", () => {
  const view = (pullRequest: object) => JSON.stringify({ data: { repository: { pullRequest } } });
  it("asks GitHub for the PR and its two latest commits in one call", () => {
    const args = prViewArgs(31);
    expect(args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    expect(args[3]).toContain("commits(last: 2)");
    expect(args).toContain("number=31");
  });
  it("reads the PR, its state, and the latest review", () => {
    const pr = readPrView(view({
      number: 31, title: "T", state: "OPEN", isDraft: true, url: "u", additions: 3, deletions: 1, headRefName: "agent/31-x", baseRefName: "main", changedFiles: 2, headRefOid: "abc",
      mergeStateStatus: "DRAFT",
      latestReviews: { nodes: [{ author: { login: "b" }, state: "APPROVED", submittedAt: T(9), commit: { oid: "new" } }, { author: { login: "a" }, state: "COMMENTED", submittedAt: T(1), commit: { oid: "old" } }] },
    }));
    expect(pr).toMatchObject({ number: 31, state: "draft", branch: "agent/31-x", base: "main", files: 2, head: "abc", merge: "DRAFT", review: { author: "b", state: "APPROVED", sha: "new" } });
    expect(readPrView(view({ number: 1, url: "u", state: "MERGED" }))).toMatchObject({ state: "merged", review: null, checks: [] });
  });
  it("pairs a running job only with an unambiguous earlier failure of the same workflow, event and job", () => {
    const workflow = (id: string, event = "push") => ({ workflowRun: { event, workflow: { id } } });
    const failed = { __typename: "CheckRun", id: "old-run", name: "e2e", status: "COMPLETED", conclusion: "FAILURE", completedAt: T(3), checkSuite: workflow("CI") };
    const running = { __typename: "CheckRun", id: "new-run", name: "e2e", status: "IN_PROGRESS", startedAt: T(4), checkSuite: workflow("CI") };
    const checks = (before: object[], after: object[] = [running], priorOid = "old") => {
      const commit = (oid: string, nodes: object[]) => ({ commit: { oid, statusCheckRollup: { contexts: { nodes } } } });
      return readPrView(view({ number: 31, url: "u", headRefOid: "new", commits: {
        nodes: [commit(priorOid, before), commit("new", after)],
      } }))?.checks;
    };
    expect(checks([failed])).toEqual([
      { name: "e2e", runId: "old-run", state: "fail", startedAt: null, completedAt: ms(3) },
      { name: "e2e", runId: "new-run", state: "running", startedAt: ms(4), completedAt: null, fixSha: "new" },
    ]);
    for (const noMatch of [
      checks([]),
      checks([failed, failed]),
      checks([failed], [running], "new"),
      checks([{ ...failed, completedAt: T(5) }]),
      checks([{ ...failed, conclusion: "SUCCESS" }]),
      checks([{ ...failed, conclusion: "CANCELLED" }]),
      checks([{ ...failed, checkSuite: workflow("other") }]),
      checks([{ ...failed, checkSuite: workflow("CI", "pull_request") }]),
    ]) expect(noMatch).toEqual([{ name: "e2e", runId: "new-run", state: "running", startedAt: ms(4), completedAt: null }]);
  });
  it("gives null when gh gave no PR", () => {
    expect(readPrView("")).toBeNull();
    expect(readPrView("{}")).toBeNull();
  });
});

describe("readFailure", () => {
  it("reads the first failure with text and ignores notices and extra message lines", () => {
    const result = JSON.stringify({ data: { node: { annotations: { nodes: [
      { annotationLevel: "NOTICE", title: "Summary" },
      { annotationLevel: "FAILURE", path: "e2e/keys.spec.ts", location: { start: { line: 88 } }, message: "Tab leaves the reply box\nExtra details" },
    ] } } } });
    expect(readFailure(result)).toEqual({ path: "e2e/keys.spec.ts", line: 88, text: "Tab leaves the reply box" });
    expect(readFailure("unavailable")).toBeUndefined();
    expect(readFailure('{"data":{"node":null}}')).toBeUndefined();
  });
});

describe("findWorker", () => {
  const list = JSON.stringify([
    { name: "b-31", parent: "t12", live: true, status: "idle", issue: "31" },
    { name: "b-31", parent: "t7", live: true, status: "working", issue: "31" },
    { name: "fix-9", parent: "t7", live: false, worktree: "/w/agent/9-fix" },
  ]);
  it("takes the chat's worker of the branch's issue", () => expect(findWorker(list, "agent/31-board", "t7")).toEqual({ name: "b-31", state: "working" }));
  it("takes the worker whose worktree is the branch", () => expect(findWorker(list, "agent/9-fix", "t7")).toEqual({ name: "fix-9", state: "done" }));
  it("gives null when no worker has the branch", () => {
    expect(findWorker(list, "main", "t7")).toBeNull();
    expect(findWorker("not json", "agent/31-board", "t7")).toBeNull();
  });
});
