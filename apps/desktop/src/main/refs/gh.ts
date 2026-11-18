import { execFile } from "node:child_process";
import type { CheckCounts, RefState } from "../../shared/api";

/** The head commit's check rollup, with the count of each check state. */
const CHECKS = "commits(last: 1) { nodes { commit { statusCheckRollup { state contexts { totalCount checkRunCountsByState { state count } statusContextCountsByState { state count } } } } } }";

/** One `gh api graphql` query for many numbers of the repository in gh's folder. */
export function refsQuery(numbers: number[]): string {
  const fields = numbers.map(
    (n) => `n${n}: issueOrPullRequest(number: ${n}) { __typename ... on PullRequest { state isDraft url ${CHECKS} } ... on Issue { state stateReason url } }`,
  );
  return `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields.join(" ")} } }`;
}

interface GhItem {
  __typename?: string;
  state?: string;
  isDraft?: boolean;
  stateReason?: string | null;
  url?: string;
  commits?: { nodes?: { commit?: { statusCheckRollup?: GhRollup | null } }[] };
}

interface GhRollup {
  state?: string;
  contexts?: {
    totalCount?: number;
    checkRunCountsByState?: { state: string; count: number }[];
    statusContextCountsByState?: { state: string; count: number }[];
  };
}

const PASSED = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);

/** The checks from gh's rollup. No rollup: the PR has no checks. */
export function toChecks(rollup: GhRollup | null | undefined): CheckCounts | undefined {
  if (!rollup?.state) return undefined;
  const counts = [...(rollup.contexts?.checkRunCountsByState ?? []), ...(rollup.contexts?.statusContextCountsByState ?? [])];
  const sum = (set: Set<string>) => counts.reduce((n, c) => n + (set.has(c.state) ? c.count : 0), 0);
  const state = rollup.state === "SUCCESS" ? "pass" : rollup.state === "FAILURE" || rollup.state === "ERROR" ? "fail" : "pending";
  return { state, passed: sum(PASSED), failed: sum(FAILED), total: rollup.contexts?.totalCount ?? 0 };
}

/** The state of each number from gh's answer. A number gh does not know is null. */
export function readRefs(json: string, numbers: number[]): Map<number, RefState | null> {
  let repo: Record<string, GhItem | null> = {};
  try {
    repo = (JSON.parse(json) as { data?: { repository?: Record<string, GhItem | null> } }).data?.repository ?? {};
  } catch {
    // Not JSON: gh failed. All numbers stay unknown.
  }
  const out = new Map<number, RefState | null>();
  for (const n of numbers) out.set(n, toState(repo[`n${n}`]));
  return out;
}

function toState(item: GhItem | null | undefined): RefState | null {
  if (!item?.url) return null;
  if (item.__typename === "PullRequest") {
    const state = item.state === "MERGED" ? "merged" : item.state === "CLOSED" ? "closed" : item.isDraft ? "draft" : "open";
    const checks = toChecks(item.commits?.nodes?.at(-1)?.commit?.statusCheckRollup);
    return checks ? { kind: "pr", state, url: item.url, checks } : { kind: "pr", state, url: item.url };
  }
  if (item.__typename === "Issue") {
    const state = item.state === "OPEN" ? "open" : item.stateReason === "NOT_PLANNED" ? "not-planned" : "closed";
    return { kind: "issue", state, url: item.url };
  }
  return null;
}

/** Runs gh in `cwd`; gh fills {owner} and {repo} from that folder's repository. CONTR_GH picks the gh program. */
export function ghRefs(cwd: string, numbers: number[], gh = process.env.CONTR_GH ?? "gh"): Promise<Map<number, RefState | null>> {
  const args = ["api", "graphql", "-f", `query=${refsQuery(numbers)}`, "-F", "owner={owner}", "-F", "repo={repo}"];
  return new Promise((resolve) => {
    // gh exits non-zero when one number is unknown, but stdout still has the others.
    execFile(gh, args, { cwd, timeout: 15_000 }, (_error, stdout) => resolve(readRefs(String(stdout ?? ""), numbers)));
  });
}

/** Keeps each number's state for a minute: at most one gh call per number per minute. */
export class RefCache<T = RefState | null> {
  private entries = new Map<number, { at: number; state: Promise<T | null> }>();

  constructor(
    private fetch: (numbers: number[]) => Promise<Map<number, T | null>>,
    private now = () => Date.now(),
    private ttlMs = 60_000,
  ) {}

  /** The states of these numbers. One batched fetch for the numbers that are missing or older than a minute. */
  async get(numbers: number[]): Promise<Record<number, T | null>> {
    const now = this.now();
    const stale = [...new Set(numbers)].filter((n) => {
      const e = this.entries.get(n);
      return !e || now - e.at >= this.ttlMs;
    });
    if (stale.length > 0) {
      const batch = this.fetch(stale);
      for (const n of stale) this.entries.set(n, { at: now, state: batch.then((m) => m.get(n) ?? null) });
    }
    const out: Record<number, T | null> = {};
    for (const n of numbers) out[n] = await this.entries.get(n)!.state;
    return out;
  }
}

/** The terminal's working folder from `hc get --json`: the foreground program's cwd, else the terminal's. */
export function readCwd(json: string): string | null {
  try {
    const t = JSON.parse(json) as { cwd?: unknown; foreground?: { cwd?: unknown } };
    const cwd = t.foreground?.cwd ?? t.cwd;
    return typeof cwd === "string" && cwd !== "" ? cwd : null;
  } catch {
    return null;
  }
}
