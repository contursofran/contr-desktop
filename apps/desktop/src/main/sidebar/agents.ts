import { appChildren } from "../children";
import path from "node:path";
import { isLiveAgent, liveWorkerParents } from "../workers/live";
import type { SidebarAgent, SidebarProject, WorkerState } from "../../shared/api";

export interface HcTerminal {
  address?: unknown;
  name?: unknown;
  cwd?: unknown;
  parent?: unknown;
  state?: unknown;
  status?: unknown;
  agent?: unknown;
}

interface OrchAgent {
  name?: unknown;
  address?: unknown;
  title?: unknown;
  issue?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function parseList<T>(json: string, key?: string): T[] {
  try {
    const v = JSON.parse(json) as unknown;
    const list = key ? (v as Record<string, unknown>)?.[key] : v;
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    return [];
  }
}

function toState(status: unknown): WorkerState {
  if (status === "working") return "working";
  if (status === "done") return "done";
  if (status === "blocked" || status === "waiting") return "blocked";
  return "idle";
}

/** One input for `buildProjects`: the live agents of `hc ls --json`, with the extra texts. */
export interface ListInput {
  hc: string;
  orch: string;
  /** Each terminal's own title (hc `get`), by address. */
  titles: Map<string, string>;
  /** Each agent's session folder (`readSessionFolder`), by address. Without one, the terminal's `cwd` is used. */
  folders?: Map<string, string>;
  /** The project of a working folder. */
  projectOf: (cwd: string) => string;
  codex?: SidebarAgent[];
}

/**
 * Groups the live agents by the project of their session folder (the terminal's `cwd` moves with a `cd`; the session's does not).
 * An agent is a live hc terminal with a `status` (a shell has none).
 * A live worker (`liveWorkerParents`, the status line's rule) whose parent is listed shows under it, with or without a `status`;
 * the orchestration tool gives its name and work.
 */
export function buildProjects({ hc, orch, titles, folders, projectOf, codex = [] }: ListInput): SidebarProject[] {
  const parents = liveWorkerParents(hc, orch);
  const terms = parseList<HcTerminal>(hc, "terminals").filter((t) => isLiveAgent(t) || parents.has(t.address as string));
  const named = new Map<string, OrchAgent>();
  for (const a of parseList<OrchAgent>(orch)) if (str(a.address)) named.set(a.address as string, a);
  const agents = new Map<string, SidebarAgent & { parent: string | null; agent: boolean; cwd: string }>();
  for (const t of terms) {
    const address = t.address as string;
    const o = named.get(address);
    const name = str(o?.name) ?? str(t.name);
    agents.set(address, {
      terminal: address,
      title: str(o?.title) ?? titles.get(address) ?? name ?? address,
      name,
      state: toState(t.status),
      kind: str(t.agent),
      issue: str(o?.issue),
      workers: [],
      parent: parents.get(address) ?? null,
      cwd: folders?.get(address) ?? str(t.cwd) ?? "",
      // A worker with no status shows only under its parent.
      agent: isLiveAgent(t),
    });
  }
  for (const chat of codex) {
    agents.set(chat.terminal, { ...chat, parent: null, agent: true, cwd: chat.cwd ?? "" });
  }
  const projects = new Map<string, SidebarAgent[]>();
  const cwds = new Map<string, string>();
  for (const a of agents.values()) {
    const parent = a.parent ? agents.get(a.parent) : undefined;
    if (parent) parent.workers.push(a);
    else if (a.agent) {
      const p = a.cwd ? projectOf(a.cwd) : "Other";
      projects.set(p, [...(projects.get(p) ?? []), a]);
      if (!cwds.has(p)) cwds.set(p, a.cwd);
    }
  }
  const clean = (a: SidebarAgent): SidebarAgent => ({
    terminal: a.terminal, cwd: a.cwd, title: a.title, name: a.name, state: a.state, kind: a.kind, issue: a.issue, workers: a.workers.map(clean),
  });
  return [...projects].map(([name, list]) => ({ name, agents: list.map(clean), cwd: cwds.get(name) ?? "", branch: null, ahead: 0, behind: 0, favicon: null }));
}

/** The project of a folder: the checkout that holds its git common dir (so a worktree goes under its checkout), else the folder's name. */
export function projectFromCommonDir(cwd: string, commonDir: string | null): string {
  if (!commonDir) return path.basename(cwd);
  const dir = path.resolve(cwd, commonDir);
  return path.basename(path.basename(dir) === ".git" ? path.dirname(dir) : dir.replace(/\.git$/, ""));
}

/** An agent's session folder from `hc get --json`: the folder of the program in front (`foreground.cwd`, the agent itself), which a `cd` in its shell does not move; null when hc gives none. */
export function readSessionFolder(json: string): string | null {
  try {
    return str((JSON.parse(json) as { foreground?: { cwd?: unknown } | null }).foreground?.cwd);
  } catch {
    return null;
  }
}

/** The terminals of an `hc ls --json` answer, and the error text when hc failed or gave no JSON. */
export function readHcList(out: string, error: string | null): { terms: HcTerminal[]; error: string | undefined } {
  if (error) return { terms: [], error };
  try {
    return { terms: (JSON.parse(out) as { terminals?: HcTerminal[] }).terminals ?? [], error: undefined };
  } catch {
    return { terms: [], error: "hc gave no JSON" };
  }
}

/** Runs a program read-only and gives its stdout ("" on failure). */
export async function run(program: string, args: string[], cwd?: string): Promise<string> {
  return (await runRead(program, args, cwd)).out;
}

/** Runs a program (10 s at most) and gives its stdout and why it failed: stderr, else the error message. `error` is null when it exited 0. */
export function runRead(program: string, args: string[], cwd?: string): Promise<{ out: string; error: string | null }> {
  return new Promise((resolve) => {
    const child = appChildren.execFile(program, args, { cwd, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }, (e, stdout, stderr) =>
      resolve({ out: String(stdout ?? ""), error: e ? (e.killed ? "no answer in 10 s" : String(stderr ?? "").trim() || e.message) : null }),
    );
    child?.stdin?.on("error", () => undefined);
  });
}
