import { execFile } from "node:child_process";
import path from "node:path";
import type { SidebarAgent, SidebarProject, WorkerState } from "../../shared/api";

interface HcTerminal {
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
  /** The project of a working folder. */
  projectOf: (cwd: string) => string;
}

/**
 * Groups the live agents by project. An agent is a live hc terminal with a `status` (a shell has none).
 * A terminal whose hc `parent` is listed shows under it as a worker; the orchestration tool gives its name and work.
 */
export function buildProjects({ hc, orch, titles, projectOf }: ListInput): SidebarProject[] {
  const terms = parseList<HcTerminal>(hc, "terminals").filter((t) => str(t.address) && t.state === "live" && t.status != null);
  const named = new Map<string, OrchAgent>();
  for (const a of parseList<OrchAgent>(orch)) if (str(a.address)) named.set(a.address as string, a);
  const agents = new Map<string, SidebarAgent & { parent: string | null; cwd: string }>();
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
      parent: str(t.parent),
      cwd: str(t.cwd) ?? "",
    });
  }
  const projects = new Map<string, SidebarAgent[]>();
  for (const a of agents.values()) {
    const parent = a.parent ? agents.get(a.parent) : undefined;
    if (parent) parent.workers.push(a);
    else {
      const p = a.cwd ? projectOf(a.cwd) : "Other";
      projects.set(p, [...(projects.get(p) ?? []), a]);
    }
  }
  const clean = (a: SidebarAgent & { parent?: unknown; cwd?: unknown }): SidebarAgent => ({
    terminal: a.terminal, title: a.title, name: a.name, state: a.state, kind: a.kind, issue: a.issue, workers: a.workers.map(clean),
  });
  return [...projects].map(([name, list]) => ({ name, agents: list.map(clean) }));
}

/** The project of a folder: the checkout that holds its git common dir (so a worktree goes under its checkout), else the folder's name. */
export function projectFromCommonDir(cwd: string, commonDir: string | null): string {
  if (!commonDir) return path.basename(cwd);
  const dir = path.resolve(cwd, commonDir);
  return path.basename(path.basename(dir) === ".git" ? path.dirname(dir) : dir.replace(/\.git$/, ""));
}

/** Runs a program read-only and gives its stdout ("" on failure). */
export function run(program: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(program, args, { cwd, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }, (_e, stdout) => resolve(String(stdout ?? "")));
  });
}
