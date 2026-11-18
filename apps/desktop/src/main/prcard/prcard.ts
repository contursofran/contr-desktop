import type { PrCard, PrCheck, WorkerState } from "../../shared/api";
import { readWorkers } from "../board/board";
import { runRead } from "../sidebar/agents";

/** One `gh pr view` gives all the card's GitHub data: the PR, its head's checks (with their times), the reviews and the merge state. */
export const prViewArgs = (n: number): string[] => [
  "pr",
  "view",
  String(n),
  "--json",
  "number,title,state,isDraft,url,additions,deletions,headRefName,baseRefName,changedFiles,headRefOid,statusCheckRollup,latestReviews,mergeStateStatus",
];

const PASSED = new Set(["SUCCESS", "NEUTRAL"]);
const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);

const ms = (t: unknown): number | null => {
  const v = typeof t === "string" && t !== "" && !t.startsWith("0001") ? Date.parse(t) : NaN;
  return Number.isFinite(v) ? v : null;
};

type Json = Record<string, unknown>;

/** One check run or status context of the rollup. A check run that is not complete runs (started) or waits (queued). */
export function toCheck(c: Json): PrCheck {
  const name = String(c.name ?? c.context ?? "");
  const startedAt = ms(c.startedAt);
  const result = String(c.__typename === "StatusContext" ? c.state : c.status === "COMPLETED" ? c.conclusion : "");
  const state: PrCheck["state"] =
    result === "SKIPPED" ? "skipped" : PASSED.has(result) ? "pass" : FAILED.has(result) ? "fail" : startedAt === null ? "queued" : "running";
  return { name, state, startedAt, completedAt: state === "running" || state === "queued" ? null : ms(c.completedAt) };
}

/** gh's answer as the card's data, without the worker. null: gh gave no PR. */
export function readPrView(out: string): Omit<PrCard, "worker"> | null {
  let pr: Json;
  try {
    pr = JSON.parse(out) as Json;
  } catch {
    return null;
  }
  if (typeof pr?.number !== "number" || typeof pr.url !== "string") return null;
  const state = pr.state === "MERGED" ? "merged" : pr.state === "CLOSED" ? "closed" : pr.isDraft ? "draft" : "open";
  const reviews = (Array.isArray(pr.latestReviews) ? (pr.latestReviews as Json[]) : []).filter((r) => typeof r?.submittedAt === "string");
  const last = reviews.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt))).at(-1);
  const sha = (last?.commit as Json | undefined)?.oid;
  return {
    number: pr.number,
    title: String(pr.title ?? ""),
    state,
    url: pr.url,
    additions: Number(pr.additions) || 0,
    deletions: Number(pr.deletions) || 0,
    branch: String(pr.headRefName ?? ""),
    base: String(pr.baseRefName ?? ""),
    files: Number(pr.changedFiles) || 0,
    head: String(pr.headRefOid ?? ""),
    checks: (Array.isArray(pr.statusCheckRollup) ? (pr.statusCheckRollup as Json[]) : []).map(toCheck),
    review: last ? { author: String((last.author as Json | undefined)?.login ?? ""), state: String(last.state ?? ""), sha: typeof sha === "string" ? sha : null } : null,
    merge: typeof pr.mergeStateStatus === "string" ? pr.mergeStateStatus : null,
  };
}

/**
 * The worker of the PR's branch (`agents ls --all --json`): its worktree ends with the branch, else its issue is the
 * branch's number (`agent/<issue>-<slug>`). The chat's own workers come first. null: no worker has this branch.
 */
export function findWorker(json: string, branch: string, parent: string): { name: string; state: WorkerState } | null {
  let list: Json[];
  try {
    const v: unknown = JSON.parse(json);
    list = Array.isArray(v) ? (v as Json[]) : [];
  } catch {
    return null;
  }
  const issue = /^agent\/(\d+)-/.exec(branch)?.[1];
  const matches = (w: Json) =>
    typeof w?.name === "string" && ((branch !== "" && typeof w.worktree === "string" && w.worktree.endsWith(`/${branch}`)) || (issue !== undefined && String(w.issue ?? "") === issue));
  const found = list.filter(matches).sort((a, b) => Number(b.parent === parent) - Number(a.parent === parent) || Number(b.live === true) - Number(a.live === true))[0];
  if (!found) return null;
  const name = found.name as string;
  return { name, state: readWorkers(JSON.stringify([found]))[name] ?? "done" };
}

/** One read of gh (in the agent's repository) and one of the tool. null: gh gave no PR. */
export async function readPrCard(p: { n: number; gh: string; orch: string; cwd: string | null; terminal: string }): Promise<PrCard | null> {
  if (!p.cwd) return null;
  const [view, workers] = await Promise.all([runRead(p.gh, prViewArgs(p.n), p.cwd), runRead(p.orch, ["agents", "ls", "--all", "--json"])]);
  const pr = view.error ? null : readPrView(view.out);
  if (!pr) return null;
  return { ...pr, worker: workers.error ? null : findWorker(workers.out, pr.branch, p.terminal) };
}
