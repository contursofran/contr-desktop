import { execFile } from "node:child_process";
import { binPath } from "../helper/binPath";
import { run } from "../sidebar/agents";
import { countLiveWorkers } from "../workers/live";
import type { PrChecks, WorkerState } from "../../shared/api";

/** The orchestration tool: CONTR_ORCH, else the bundled binary (see binPath). */
export function orchPath(appRoot: string, env = process.env): string {
  return binPath("herdr-contr-orch", appRoot, env.CONTR_ORCH);
}

interface OrchWorker {
  name?: unknown;
  parent?: unknown;
  live?: unknown;
  status?: unknown;
}

function toState(w: OrchWorker): WorkerState {
  if (w.live !== true) return "done";
  if (w.status === "working") return "working";
  if (w.status === "blocked" || w.status === "waiting") return "blocked";
  return "idle";
}

function parseList(json: string): OrchWorker[] {
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? (list as OrchWorker[]) : [];
  } catch {
    return [];
  }
}

/**
 * Each worker's state from `agents ls --all --json`. A name listed twice keeps its live entry.
 * With `parent`, a name that has an entry under that parent uses only those entries
 * (names such as `b-10` repeat across projects); other names fall back to all entries.
 */
export function readWorkers(json: string, parent?: string): Record<string, WorkerState> {
  const list = parseList(json);
  const mine = new Set(list.filter((w) => parent !== undefined && w?.parent === parent).map((w) => w.name));
  const out: Record<string, WorkerState> = {};
  for (const w of list) {
    if (mine.has(w?.name) && w.parent !== parent) continue;
    if (typeof w?.name !== "string") continue;
    if (out[w.name] && out[w.name] !== "done" && w.live !== true) continue;
    out[w.name] = toState(w);
  }
  return out;
}

/** One read-only run of the tool and of hc: the board's worker states and the agent's live worker count (the sidebar's rule). */
export async function orchBoard(orch: string, hc: string, parent: string): Promise<{ workers: Record<string, WorkerState>; orchestrating: number }> {
  const [json, hcJson] = await Promise.all([run(orch, ["agents", "ls", "--all", "--json"]), run(hc, ["ls", "--json"])]);
  return { workers: readWorkers(json, parent), orchestrating: countLiveWorkers(hcJson, json, parent) };
}

/** Runs the tool read-only: `agents ls --all --json`. A missing or failed tool gives no workers. */
export function orchWorkers(orch: string): Promise<Record<string, WorkerState>> {
  return new Promise((resolve) => {
    execFile(orch, ["agents", "ls", "--all", "--json"], { timeout: 10_000 }, (_error, stdout) => resolve(readWorkers(String(stdout ?? ""))));
  });
}

/** One `gh api graphql` query: for each issue, the last PR that closes it and the checks of its head. */
export function checksQuery(issues: number[]): string {
  const fields = issues.map(
    (n) =>
      `n${n}: issue(number: ${n}) { closedByPullRequestsReferences(last: 1, includeClosedPrs: true) { nodes { number commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } } }`,
  );
  return `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields.join(" ")} } }`;
}

interface GhIssue {
  closedByPullRequestsReferences?: {
    nodes?: { number?: number; commits?: { nodes?: { commit?: { statusCheckRollup?: { state?: string } | null } }[] } }[];
  };
}

function toChecks(state: string | undefined): PrChecks["checks"] {
  if (state === "SUCCESS") return "pass";
  if (state === "FAILURE" || state === "ERROR") return "fail";
  if (state === "PENDING" || state === "EXPECTED") return "pending";
  return null;
}

/** The PR and its checks for each issue. An issue with no PR, or that gh does not know, is null. */
export function readChecks(json: string, issues: number[]): Map<number, PrChecks | null> {
  let repo: Record<string, GhIssue | null> = {};
  try {
    repo = (JSON.parse(json) as { data?: { repository?: Record<string, GhIssue | null> } }).data?.repository ?? {};
  } catch {
    // Not JSON: gh failed. All issues stay unknown.
  }
  const out = new Map<number, PrChecks | null>();
  for (const n of issues) {
    const pr = repo[`n${n}`]?.closedByPullRequestsReferences?.nodes?.at(-1);
    const rollup = pr?.commits?.nodes?.at(-1)?.commit?.statusCheckRollup?.state;
    out.set(n, typeof pr?.number === "number" ? { pr: pr.number, checks: toChecks(rollup) } : null);
  }
  return out;
}

/** Runs gh in `cwd` (gh fills {owner} and {repo}). CONTR_GH picks the gh program. */
export function ghChecks(cwd: string, issues: number[], gh = process.env.CONTR_GH ?? "gh"): Promise<Map<number, PrChecks | null>> {
  const args = ["api", "graphql", "-f", `query=${checksQuery(issues)}`, "-F", "owner={owner}", "-F", "repo={repo}"];
  return new Promise((resolve) => {
    execFile(gh, args, { cwd, timeout: 15_000 }, (_error, stdout) => resolve(readChecks(String(stdout ?? ""), issues)));
  });
}
