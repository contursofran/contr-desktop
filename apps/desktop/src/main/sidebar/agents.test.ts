import { describe, expect, it } from "vitest";
import { buildProjects, projectFromCommonDir, readHcList, runHcList } from "./agents";

const hc = JSON.stringify({
  terminals: [
    { address: "t1", name: "orch", cwd: "/w/app", state: "live", status: "working", agent: "claude-code" },
    { address: "t2", cwd: "/w/app-wt/x", parent: "t1", state: "live", status: "done" },
    { address: "t3", cwd: "/w/app-wt/y", parent: "t2", state: "live", status: "waiting" },
    { address: "t4", cwd: "/w/lib", parent: "t9", state: "live", status: "idle" },
    { address: "t5", cwd: "/w/lib", state: "live" },
    { address: "t6", cwd: "/w/lib", state: "finished", status: "done" },
  ],
});
const orch = JSON.stringify([{ name: "b-2", address: "t2", parent: "t1", live: true, title: "Fix it", issue: "12" }]);

describe("buildProjects", () => {
  it("groups live agents by project and puts workers under their parent", () => {
    const out = buildProjects({ hc, orch, titles: new Map([["t1", "Audit"]]), projectOf: (c) => c.split("/")[2] });
    expect(out).toEqual([
      {
        name: "app",
        agents: [
          {
            terminal: "t1", title: "Audit", name: "orch", state: "working", kind: "claude-code", issue: null,
            workers: [{ terminal: "t2", title: "Fix it", name: "b-2", state: "done", kind: null, issue: "12", workers: [{ terminal: "t3", title: "t3", name: null, state: "blocked", kind: null, issue: null, workers: [] }] }],
          },
        ],
        cwd: "/w/app", branch: null, ahead: 0, behind: 0, favicon: null,
      },
      { name: "lib", agents: [{ terminal: "t4", title: "t4", name: null, state: "idle", kind: null, issue: null, workers: [] }], cwd: "/w/lib", branch: null, ahead: 0, behind: 0, favicon: null },
    ]);
  });

  it("gives no projects when hc fails", () => {
    expect(buildProjects({ hc: "oops", orch: "", titles: new Map(), projectOf: () => "x" })).toEqual([]);
  });
});

describe("projectFromCommonDir", () => {
  it("names a checkout, a worktree under its checkout, and a folder with no git", () => {
    expect(projectFromCommonDir("/w/app", ".git")).toBe("app");
    expect(projectFromCommonDir("/w/app-wt/x", "/w/app/.git")).toBe("app");
    expect(projectFromCommonDir("/w/bare", "/w/bare.git")).toBe("bare");
    expect(projectFromCommonDir("/w/plain", null)).toBe("plain");
  });
});

describe("buildProjects workers", () => {
  it("shows a stopped worker (tool live false) as an agent of its own, not under its parent", () => {
    const stopped = JSON.stringify([{ name: "b-2", address: "t2", parent: "t1", live: false }]);
    const out = buildProjects({ hc, orch: stopped, titles: new Map(), projectOf: (c) => c.split("/")[2] });
    expect(out.flatMap((p) => p.agents.map((a) => [a.terminal, a.workers.length]))).toEqual([["t1", 0], ["t2", 1], ["t4", 0]]);
  });
});

describe("readHcList", () => {
  it("gives the terminals and no error when hc answered", () => {
    expect(readHcList(hc, null)).toEqual({ terms: JSON.parse(hc).terminals, error: undefined });
  });
  it("keeps hc's error text when hc failed", () => {
    expect(readHcList("", "hc: core is not running")).toEqual({ terms: [], error: "hc: core is not running" });
  });
  it("says hc gave no JSON when it exited 0 with other text", () => {
    expect(readHcList("not json", null)).toEqual({ terms: [], error: "hc gave no JSON" });
  });
});

describe("runHcList", () => {
  it("gives the spawn error of a missing hc", async () => {
    const got = await runHcList("/nonexistent/hc");
    expect(got.error).toContain("ENOENT");
  });
  it("gives the error message when hc exits non-zero with no stderr", async () => {
    const got = await runHcList("/usr/bin/false");
    expect(got.error).toContain("Command failed");
  });
});
