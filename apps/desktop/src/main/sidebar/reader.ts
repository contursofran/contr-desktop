import type { Sidebar } from "../../shared/api";
import { readTitle } from "../helper/title";
import { buildProjects, projectFromCommonDir, readHcList, readSessionFolder, runRead, type HcTerminal } from "./agents";
import { faviconUrl, gitState } from "./git";

/** At most this many `hc get` run at once. */
export const GET_LIMIT = 8;

/** Runs a program read-only and gives its stdout and why it failed (`runRead`). */
export type Exec = (program: string, args: string[]) => Promise<{ out: string; error: string | null }>;

export interface ReaderOptions {
  hc: string;
  git: string;
  /** The orchestration tool, found again on each read. */
  orch: () => string;
  exec?: Exec;
  favicon?: (cwd: string) => string | null;
}

export interface SidebarReader {
  /** Reads the list. `hc get` runs only for a terminal that is new, changed in `hc ls` or marked; git only for a new project or when due. */
  read(): Promise<Omit<Sidebar, "selected">>;
  /** An `hc events` line: marks the terminal it names, so the next read gets it again. */
  event(line: string): void;
  /** The next read reads git again for each shown project. */
  gitDue(): void;
}

interface Got {
  key: string;
  title: string;
  folder: string | null;
}

/** What in `hc ls --json` tells that a terminal's title or session folder can have changed: a new turn, status or folder. */
function changeKey(t: HcTerminal & { turn?: unknown }): string {
  return JSON.stringify([t.turn ?? null, t.status ?? null, t.cwd ?? null]);
}

/** Runs `fn` on each item, `limit` at a time. */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/**
 * The Projects list read with few processes: one `hc ls --json` and one orchestration tool read each time;
 * `hc get --json` (title and session folder) only for a terminal that is new, whose `turn`, `status` or `cwd` changed,
 * or that an `hc events` line names (other than a status line, which `hc ls` shows). The others keep their last answer.
 */
export function sidebarReader({ hc, git, orch, exec = runRead, favicon = faviconUrl }: ReaderOptions): SidebarReader {
  const got = new Map<string, Got>();
  const marked = new Set<string>();
  const gits = new Map<string, { branch: string | null; ahead: number; behind: number }>();
  let gitAll = false;
  // A folder's project: kept while the folder shows. A failed `git rev-parse` (not "not a git repository") is tried again on the next read.
  const projects = new Map<string, Promise<string>>();
  const projectOf = (cwd: string) => {
    let p = projects.get(cwd);
    if (!p) {
      p = exec(git, ["-C", cwd, "rev-parse", "--git-common-dir"]).then(({ out, error }) => {
        if (error && !/not a git repository/i.test(error)) projects.delete(cwd);
        return projectFromCommonDir(cwd, (error ? "" : out.trim()) || null);
      });
      projects.set(cwd, p);
    }
    return p;
  };
  const favicons = new Map<string, string | null>();

  const read = async () => {
    const [hcList, orchOut] = await Promise.all([exec(hc, ["ls", "--json"]), exec(orch(), ["agents", "ls", "--all", "--json"])]);
    // hc failed: no agents, and the renderer shows why.
    const { terms, error: hcError } = readHcList(hcList.out, hcList.error);
    const live = terms.filter((t): t is HcTerminal & { address: string } => typeof t.address === "string");
    const addresses = new Set(live.map((t) => t.address));
    for (const a of got.keys()) if (!addresses.has(a)) got.delete(a);
    for (const a of marked) if (!addresses.has(a)) marked.delete(a);
    const todo = live.filter((t) => got.get(t.address)?.key !== changeKey(t) || marked.has(t.address));
    await eachLimited(todo, GET_LIMIT, async (t) => {
      marked.delete(t.address);
      const r = await exec(hc, ["get", "--json", t.address]);
      const entry = { key: changeKey(t), title: readTitle(r.out, ""), folder: readSessionFolder(r.out) };
      // A failed get is tried again on the next read; until then the last answer stays.
      if (!r.error) got.set(t.address, entry);
    });
    const titles = new Map<string, string>();
    const folders = new Map<string, string>();
    for (const [a, g] of got) {
      if (g.title) titles.set(a, g.title);
      if (g.folder) folders.set(a, g.folder);
    }
    const cwds = new Set([...live.map((t) => t.cwd), ...folders.values()].filter((c): c is string => typeof c === "string" && c !== ""));
    for (const c of projects.keys()) if (!cwds.has(c)) projects.delete(c);
    const names = new Map<string, string>();
    await Promise.all([...cwds].map(async (c) => names.set(c, await projectOf(c))));
    const built = buildProjects({ hc: hcList.out, orch: orchOut.out, titles, folders, projectOf: (c) => names.get(c) ?? c });
    const shown = new Set(built.map((p) => p.cwd));
    for (const c of gits.keys()) if (!shown.has(c)) gits.delete(c);
    for (const c of favicons.keys()) if (!shown.has(c)) favicons.delete(c);
    const due = gitAll;
    gitAll = false;
    const list = await Promise.all(
      built.map(async (p) => {
        if (due || !gits.has(p.cwd)) gits.set(p.cwd, await gitState(git, p.cwd, exec));
        if (!favicons.has(p.cwd)) favicons.set(p.cwd, favicon(p.cwd));
        return { ...p, ...gits.get(p.cwd)!, favicon: favicons.get(p.cwd)! };
      }),
    );
    return { projects: list, ...(hcError ? { hcError } : {}) };
  };

  const event = (line: string) => {
    try {
      const p = (JSON.parse(line) as { params?: { terminal?: unknown; type?: unknown } }).params;
      if (typeof p?.terminal === "string" && p.type !== "status") marked.add(p.terminal);
    } catch {
      // Not one JSON line: nothing to mark. The read still runs.
    }
  };

  return { read, event, gitDue: () => (gitAll = true) };
}
