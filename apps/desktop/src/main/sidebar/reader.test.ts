import { describe, expect, it } from "vitest";
import type { SidebarAgent } from "../../shared/api";
import { GET_LIMIT, sidebarReader, type Exec } from "./reader";

interface Term {
  address: string;
  cwd: string;
  status: string;
  turn: number;
  title: string;
}

/** A counting fake of hc, git and the orchestration tool. `hc ls` gives the terminals without their title; `hc get` gives the title and the session folder. */
function fakes(n: number) {
  const terms: Term[] = Array.from({ length: n }, (_, i) => ({ address: `t${i}`, cwd: `/w/p${i % 50}`, status: "working", turn: 1, title: `Title ${i}` }));
  const calls: string[] = [];
  let running = 0;
  let most = 0;
  const failGet = new Set<string>();
  let revParseError: string | null = null;
  const exec: Exec = async (program, args) => {
    const line = `${program} ${args.join(" ")}`;
    calls.push(line);
    if (program === "hc" && args[0] === "ls") {
      return { out: JSON.stringify({ terminals: terms.map((t) => ({ ...t, title: undefined, state: "live", agent: "claude-code" })) }), error: null };
    }
    if (program === "hc" && args[0] === "get") {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
      const t = terms.find((x) => x.address === args[2]);
      if (!t || failGet.has(t.address)) return { out: "", error: "no such terminal" };
      return { out: JSON.stringify({ address: t.address, title: t.title, foreground: { cwd: t.cwd } }), error: null };
    }
    if (program === "git" && args[2] === "rev-parse") return revParseError ? { out: "", error: revParseError } : { out: ".git\n", error: null };
    if (program === "git" && args[2] === "branch") return { out: "main\n", error: null };
    if (program === "git") return { out: "1\t2\n", error: null };
    return { out: "[]", error: null };
  };
  const count = (prefix: string) => calls.filter((c) => c.startsWith(prefix)).length;
  const reset = () => (calls.length = 0);
  return { terms, exec, count, reset, failGet, most: () => most, setRevParseError: (e: string | null) => (revParseError = e) };
}

const titleOf = (s: Awaited<ReturnType<ReturnType<typeof sidebarReader>["read"]>>, address: string) =>
  s.projects.flatMap((p) => p.agents).find((a) => a.terminal === address)?.title;

describe("sidebarReader", () => {
  it("returns an hc outage without waiting for orchestration and reads fresh data after recovery", async () => {
    const f = fakes(1);
    const reason = "hc is not reachable";
    let down = false;
    let finishOrch!: (result: Awaited<ReturnType<Exec>>) => void;
    const heldOrch = new Promise<Awaited<ReturnType<Exec>>>((resolve) => { finishOrch = resolve; });
    const exec: Exec = (program, args) => {
      if (down && program === "hc") return Promise.resolve({ out: "", error: reason });
      if (down && program === "orch") return heldOrch;
      return f.exec(program, args);
    };
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec, favicon: () => null });
    await reader.read();

    down = true;
    const outage = reader.read();
    const checkpoint = new Promise<string>((resolve) => setImmediate(() => resolve("read is still pending")));
    try {
      await expect(Promise.race([outage, checkpoint])).resolves.toEqual({ projects: [], hcError: reason });
    } finally {
      finishOrch({ out: "[]", error: null });
      await outage;
    }

    down = false;
    f.terms[0]!.title = "Title after outage";
    f.reset();
    const recovered = await reader.read();
    expect(f.count("hc get --json t0")).toBe(1);
    expect(f.count("orch")).toBe(1);
    expect(titleOf(recovered, "t0")).toBe("Title after outage");
    expect(recovered.hcError).toBeUndefined();
  });

  it("lists a native Codex project when hc is down", async () => {
    const f = fakes(0);
    const exec: Exec = (program, args) => program === "hc"
      ? Promise.resolve({ out: "", error: "hc is not reachable" })
      : f.exec(program, args);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec, favicon: () => null });
    const chat: SidebarAgent = {
      terminal: "codex:thread", cwd: "/w/workspace", title: "Workspace overview",
      name: null, state: "idle", kind: "codex", issue: null, workers: [],
    };
    await expect(reader.read([chat])).resolves.toMatchObject({
      hcError: "hc is not reachable",
      projects: [{ name: "workspace", cwd: "/w/workspace", branch: "main", agents: [chat] }],
    });
    expect(f.count("orch")).toBe(0);
  });

  it("runs hc get once for each new agent, none when idle, and one for a changed agent", async () => {
    const f = fakes(200);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });

    const first = await reader.read();
    expect(f.count("hc get")).toBe(200);
    expect(f.most()).toBeLessThanOrEqual(GET_LIMIT);
    expect(f.most()).toBe(GET_LIMIT);
    expect(first.projects).toHaveLength(50);
    expect(titleOf(first, "t5")).toBe("Title 5");

    f.reset();
    const idle = await reader.read();
    expect(f.count("hc get")).toBe(0);
    expect(f.count("hc ls")).toBe(1);
    expect(titleOf(idle, "t5")).toBe("Title 5");

    // hc gives a new turn for one agent: its new title shows.
    f.terms[5]!.turn = 2;
    f.terms[5]!.title = "New title";
    f.reset();
    const changed = await reader.read();
    expect(f.count("hc get")).toBe(1);
    expect(f.count("hc get --json t5")).toBe(1);
    expect(titleOf(changed, "t5")).toBe("New title");
  });

  it("gets a terminal again when its status or cwd changes", async () => {
    const f = fakes(3);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });
    await reader.read();
    f.terms[0]!.status = "done";
    f.terms[1]!.cwd = "/w/other";
    f.reset();
    await reader.read();
    expect(f.count("hc get")).toBe(2);
  });

  it("gets a terminal again when an hc events line other than a status line names it", async () => {
    const f = fakes(3);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });
    await reader.read();
    f.terms[1]!.title = "Renamed";
    reader.event(JSON.stringify({ jsonrpc: "2.0", method: "event", params: { terminal: "t2", type: "status", data: {} } }));
    reader.event("not JSON");
    f.reset();
    await reader.read();
    expect(f.count("hc get")).toBe(0);

    reader.event(JSON.stringify({ jsonrpc: "2.0", method: "event", params: { terminal: "t1", type: "title", data: {} } }));
    f.reset();
    const s = await reader.read();
    expect(f.count("hc get --json t1")).toBe(1);
    expect(f.count("hc get")).toBe(1);
    expect(titleOf(s, "t1")).toBe("Renamed");
  });

  it("drops a gone terminal and tries a failed get again", async () => {
    const f = fakes(3);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });
    f.failGet.add("t0");
    await reader.read();
    f.failGet.clear();
    f.reset();
    await reader.read();
    expect(f.count("hc get")).toBe(1);

    const gone = f.terms.splice(2, 1);
    await reader.read();
    f.terms.push(...gone);
    f.reset();
    await reader.read();
    expect(f.count("hc get --json t2")).toBe(1);
  });

  it("reads git for a new project and, when due, only for the shown projects", async () => {
    const f = fakes(4);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });
    const first = await reader.read();
    expect(f.count("git -C /w/p0 branch")).toBe(1);
    expect(first.projects[0]).toMatchObject({ branch: "main", ahead: 1, behind: 2 });
    f.reset();
    await reader.read();
    expect(f.count("git")).toBe(0);

    f.terms.splice(3, 1);
    reader.gitDue();
    f.reset();
    await reader.read();
    expect(f.count("git -C /w/p0 branch")).toBe(1);
    expect(f.count("git -C /w/p3")).toBe(0);
    expect(f.count("git") / 2).toBe(3);
  });

  it("keeps a folder that is not a git repository, and tries a failed git rev-parse again", async () => {
    const f = fakes(1);
    const reader = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: f.exec, favicon: () => null });
    f.setRevParseError("fatal: not a git repository (or any of the parent directories): .git");
    await reader.read();
    f.reset();
    await reader.read();
    expect(f.count("git -C /w/p0 rev-parse")).toBe(0);

    const g = fakes(1);
    const other = sidebarReader({ hc: "hc", git: "git", orch: () => "orch", exec: g.exec, favicon: () => null });
    g.setRevParseError("fatal: unable to read index");
    const s = await other.read();
    expect(s.projects[0]!.name).toBe("p0");
    g.reset();
    await other.read();
    expect(g.count("git -C /w/p0 rev-parse")).toBe(1);
  });
});
