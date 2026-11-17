import { describe, expect, it } from "vitest";
import { buildProjects, projectFromCommonDir, readHcList, readSessionFolder, run, runRead } from "./agents";

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

describe("buildProjects session folders (#136)", () => {
  // Made-up shapes of `hc ls --json`, `agents ls --all --json` and each `hc get --json` `foreground.cwd`.
  const live = (address: string, cwd: string, extra: Record<string, unknown> = {}) => ({ address, cwd, state: "live", status: "working", agent: "claude-code", ...extra });
  const two = JSON.stringify({
    terminals: [
      // A coordinator of "game" that ran `cd` into "web", status done.
      live("t81", "/w/web", { status: "done" }),
      live("t91", "/w/game-wt/walker-1", { parent: "t81", name: "b-1" }),
      live("t92", "/w/game-wt/art-2", { parent: "t81", name: "c-2" }),
      // A worker that has just started: no status yet.
      { address: "t93", cwd: "/w/game-wt/plan-3", state: "live", parent: "t81", name: "p-3" },
      // A coordinator of "desk" that ran `cd` into "tools".
      live("t7k", "/w/tools"),
      live("t97", "/w/desk-wt/agent/113", { parent: "t7k", name: "b-113" }),
      live("t98", "/w/desk-wt/agent/116", { parent: "t7k", name: "b-116", status: "done" }),
      // A plain shell in "web" and a statusless child of a terminal that is not listed: neither is an agent.
      { address: "t6p", cwd: "/w/web", state: "live" },
      { address: "t99", cwd: "/w/web", state: "live", parent: "t6p" },
    ],
  });
  const tool = JSON.stringify([
    { name: "b-1", address: "t91", parent: "t81", live: true },
    { name: "c-2", address: "t92", parent: "t81", live: true },
    { name: "p-3", address: "t93", parent: "t81", live: true },
    { name: "b-113", address: "t97", parent: "t7k", live: true },
    { name: "b-116", address: "t98", parent: "t7k", live: true },
  ]);
  const folders = new Map([["t81", "/w/game"], ["t7k", "/w/desk"], ["t91", "/w/game-wt/walker-1"], ["t97", "/w/desk-wt/agent/113"]]);
  const common: Record<string, string> = { "/w/game-wt/walker-1": "/w/game/.git", "/w/desk-wt/agent/113": "/w/desk/.git", "/w/desk-wt/x": "/w/desk/.git" };
  const projectOf = (c: string) => projectFromCommonDir(c, common[c] ?? ".git");
  const tree = (out: ReturnType<typeof buildProjects>) =>
    out.map((p) => [p.name, p.cwd, p.agents.map((a) => [a.terminal, a.workers.map((w) => w.terminal)])]);

  it("puts each coordinator under its session folder's project, with all its live workers, in two projects", () => {
    expect(tree(buildProjects({ hc: two, orch: tool, titles: new Map(), folders, projectOf }))).toEqual([
      ["game", "/w/game", [["t81", ["t91", "t92", "t93"]]]],
      ["desk", "/w/desk", [["t7k", ["t97", "t98"]]]],
    ]);
  });

  it("uses the terminal's cwd when the session folder is not known", () => {
    expect(tree(buildProjects({ hc: two, orch: tool, titles: new Map(), projectOf }))).toEqual([
      ["web", "/w/web", [["t81", ["t91", "t92", "t93"]]]],
      ["tools", "/w/tools", [["t7k", ["t97", "t98"]]]],
    ]);
  });

  it("puts an agent whose session is in a worktree under its checkout, after a cd", () => {
    const one = JSON.stringify({ terminals: [live("t5", "/w/elsewhere")] });
    const out = buildProjects({ hc: one, orch: "", titles: new Map(), folders: new Map([["t5", "/w/desk-wt/x"]]), projectOf });
    expect(tree(out)).toEqual([["desk", "/w/desk-wt/x", [["t5", []]]]]);
  });

  it("shows a worker with no status under its parent with hc's parent alone", () => {
    const out = buildProjects({ hc: two, orch: "", titles: new Map(), folders, projectOf });
    expect(out[0].agents[0].workers.map((w) => [w.terminal, w.state])).toEqual([["t91", "working"], ["t92", "working"], ["t93", "idle"]]);
  });
});

describe("readSessionFolder", () => {
  it("gives the folder of the program in front, else null", () => {
    expect(readSessionFolder(JSON.stringify({ cwd: "/w/web", foreground: { cwd: "/w/game", name: "2.1.326" } }))).toBe("/w/game");
    expect(readSessionFolder(JSON.stringify({ cwd: "/w/web", foreground: null }))).toBeNull();
    expect(readSessionFolder(JSON.stringify({ cwd: "/w/web" }))).toBeNull();
    expect(readSessionFolder("not json")).toBeNull();
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

describe("runRead", () => {
  it("gives the spawn error of a missing program", async () => {
    expect((await runRead("/nonexistent/hc", ["ls", "--json"])).error).toContain("ENOENT");
  });
  it("gives the error message when the program exits non-zero with no stderr", async () => {
    expect((await runRead("/usr/bin/false", [])).error).toContain("Command failed");
  });
  const node = process.execPath;
  it("gives stdout and no error when the program exits 0", async () => {
    expect(await runRead(node, ["-e", "process.stdout.write('[]')"])).toEqual({ out: "[]", error: null });
  });
  it("gives stderr as the error when the program exits non-zero; run still gives its stdout", async () => {
    const args = ["-e", "process.stdout.write('part'); process.stderr.write('the owner file is locked\\n'); process.exit(1)"];
    expect(await runRead(node, args)).toEqual({ out: "part", error: "the owner file is locked" });
    expect(await run(node, args)).toBe("part");
  });
});
