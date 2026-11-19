import type { PrCard, PrCheck, WorkerState } from "../../shared/api";
import { readWorkers } from "../board/board";
import { runRead } from "../sidebar/agents";

/** Read the head's checks and the prior commit's checks with their GitHub run IDs. */
const PR_VIEW = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number title state isDraft url additions deletions headRefName baseRefName changedFiles headRefOid mergeStateStatus
      latestReviews(first: 100) { nodes { author { login } state submittedAt commit { oid } } }
      commits(last: 2) {
        nodes { commit { oid statusCheckRollup { contexts(first: 100) { nodes {
          __typename
          ... on CheckRun {
            id name status conclusion startedAt completedAt
            checkSuite { workflowRun { event workflow { id } } }
          }
          ... on StatusContext { context state createdAt }
        } } } } }
      }
    }
  }
}`;

const ANNOTATIONS = `query($id: ID!) {
  node(id: $id) {
    ... on CheckRun { annotations(first: 100) {
      nodes { annotationLevel path location { start { line } } title message }
    } }
  }
}`;

export const prViewArgs = (n: number): string[] => [
  "api", "graphql", "-f", `query=${PR_VIEW}`, "-F", "owner={owner}", "-F", "repo={repo}", "-F", `number=${n}`,
];

const PASSED = new Set(["SUCCESS", "NEUTRAL"]);
const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);

const ms = (t: unknown): number | null => {
  const v = typeof t === "string" && t !== "" && !t.startsWith("0001") ? Date.parse(t) : NaN;
  return Number.isFinite(v) ? v : null;
};

type Json = Record<string, unknown>;
const object = (value: unknown): Json | undefined => value && typeof value === "object" ? value as Json : undefined;
const nodes = (connection: unknown): Json[] => {
  const items = object(connection)?.nodes;
  return Array.isArray(items) ? items.filter((item) => object(item) !== undefined) : [];
};

function readData(out: string): Json | undefined {
  try {
    return object(object(JSON.parse(out))?.data);
  } catch {
    return undefined;
  }
}

/** One check run or status context of the rollup. A check run that is not complete runs (started) or waits (queued). */
export function toCheck(c: Json): PrCheck {
  const name = String(c.name ?? c.context ?? "");
  const startedAt = ms(c.startedAt ?? c.createdAt);
  const result = String(c.__typename === "StatusContext" ? c.state : c.status === "COMPLETED" ? c.conclusion : "");
  const state: PrCheck["state"] =
    result === "SKIPPED" ? "skipped" : PASSED.has(result) ? "pass" : FAILED.has(result) ? "fail" : startedAt === null ? "queued" : "running";
  return { name, state, startedAt, completedAt: state === "running" || state === "queued" ? null : ms(c.completedAt) };
}

type CheckRead = PrCheck & { runId?: string };

function runKey(run: Json): string | undefined {
  const workflowRun = object(object(run.checkSuite)?.workflowRun);
  const workflow = object(workflowRun?.workflow)?.id;
  const event = workflowRun?.event;
  return typeof workflow === "string" && typeof event === "string" ? JSON.stringify([workflow, event, run.name]) : undefined;
}

const commitChecks = (commit: Json | undefined) => nodes(object(commit?.statusCheckRollup)?.contexts);

function checkRead(run: Json): CheckRead {
  return { ...toCheck(run), ...(typeof run.id === "string" ? { runId: run.id } : {}) };
}

function readChecks(pr: Json): CheckRead[] {
  const commits = nodes(pr.commits);
  const head = object(commits.at(-1)?.commit);
  const previous = object(commits.at(-2)?.commit);
  if (!head || head.oid !== pr.headRefOid) return [];
  const headSha = head.oid;
  const before = commitChecks(previous);
  const current = commitChecks(head);
  return current.flatMap((run) => {
    const check = checkRead(run);
    if (check.state !== "running" || typeof headSha !== "string" || typeof previous?.oid !== "string" || previous.oid === headSha) return [check];
    const key = runKey(run);
    if (!key || current.filter((other) => runKey(other) === key).length !== 1) return [check];
    const matches = before.filter((other) => runKey(other) === key);
    if (matches.length !== 1 || matches[0].conclusion !== "FAILURE") return [check];
    const failed = checkRead(matches[0]);
    if (failed.state !== "fail" || failed.completedAt === null || check.startedAt === null || failed.completedAt > check.startedAt) return [check];
    return [failed, { ...check, fixSha: headSha }];
  });
}

/** gh's answer as the card's data before the annotation and worker reads. */
export function readPrView(out: string): (Omit<PrCard, "worker" | "checks"> & { checks: CheckRead[] }) | null {
  const pr = object(object(readData(out)?.repository)?.pullRequest);
  if (typeof pr?.number !== "number" || typeof pr.url !== "string") return null;
  const state = pr.state === "MERGED" ? "merged" : pr.state === "CLOSED" ? "closed" : pr.isDraft ? "draft" : "open";
  const reviews = nodes(pr.latestReviews).filter((r) => typeof r.submittedAt === "string");
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
    checks: readChecks(pr),
    review: last ? { author: String((last.author as Json | undefined)?.login ?? ""), state: String(last.state ?? ""), sha: typeof sha === "string" ? sha : null } : null,
    merge: typeof pr.mergeStateStatus === "string" ? pr.mergeStateStatus : null,
  };
}

/** The first failure with text. GitHub may have no annotation for a failed check. */
export function readFailure(out: string): PrCheck["failure"] {
  for (const annotation of nodes(object(readData(out)?.node)?.annotations)) {
    if (annotation.annotationLevel !== "FAILURE") continue;
    const text = [annotation.title, annotation.message]
      .find((value): value is string => typeof value === "string" && value.trim() !== "")?.trim().split(/\r?\n/, 1)[0];
    if (!text) continue;
    const line = object(object(annotation.location)?.start)?.line;
    return { path: typeof annotation.path === "string" ? annotation.path : "", line: typeof line === "number" && line > 0 ? line : null, text };
  }
  return undefined;
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

/** Read the PR and its worker. Only displayed failed check runs need an annotation read. */
export async function readPrCard(p: { n: number; gh: string; orch: string; cwd: string | null; terminal: string }): Promise<PrCard | null> {
  const { cwd } = p;
  if (!cwd) return null;
  const [view, workers] = await Promise.all([runRead(p.gh, prViewArgs(p.n), cwd), runRead(p.orch, ["agents", "ls", "--all", "--json"])]);
  // GitHub can return the PR with partial data and a non-zero exit code.
  const pr = readPrView(view.out);
  if (!pr) return null;
  const checks = await Promise.all(pr.checks.map(async ({ runId, ...check }) => {
    if (check.state !== "fail" || !runId) return check;
    const result = await runRead(p.gh, ["api", "graphql", "-f", `query=${ANNOTATIONS}`, "-f", `id=${runId}`], cwd);
    const failure = result.error ? undefined : readFailure(result.out);
    return failure ? { ...check, failure } : check;
  }));
  return { ...pr, checks, worker: workers.error ? null : findWorker(workers.out, pr.branch, p.terminal) };
}
