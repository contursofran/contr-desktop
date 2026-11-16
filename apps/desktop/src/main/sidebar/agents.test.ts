import { describe, expect, it } from "vitest";
import { buildProjects, projectFromCommonDir } from "./agents";

const hc = JSON.stringify({
  terminals: [
    { address: "t1", name: "orch", cwd: "/w/app", state: "live", status: "working" },
    { address: "t2", cwd: "/w/app-wt/x", parent: "t1", state: "live", status: "done" },
    { address: "t3", cwd: "/w/app-wt/y", parent: "t2", state: "live", status: "waiting" },
    { address: "t4", cwd: "/w/lib", parent: "t9", state: "live", status: "idle" },
    { address: "t5", cwd: "/w/lib", state: "live" },
    { address: "t6", cwd: "/w/lib", state: "finished", status: "done" },
  ],
});
const orch = JSON.stringify([{ name: "b-2", address: "t2", title: "Fix it" }]);

describe("buildProjects", () => {
  it("groups live agents by project and puts workers under their parent", () => {
    const out = buildProjects({ hc, orch, titles: new Map([["t1", "Audit"]]), projectOf: (c) => c.split("/")[2] });
    expect(out).toEqual([
      {
        name: "app",
        agents: [
          {
            terminal: "t1", title: "Audit", name: "orch", state: "working",
            workers: [{ terminal: "t2", title: "Fix it", name: "b-2", state: "done", workers: [{ terminal: "t3", title: "t3", name: null, state: "blocked", workers: [] }] }],
          },
        ],
      },
      { name: "lib", agents: [{ terminal: "t4", title: "t4", name: null, state: "idle", workers: [] }] },
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
