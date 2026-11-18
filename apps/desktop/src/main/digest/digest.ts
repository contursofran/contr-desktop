import type { Digest, FeedRow } from "../../shared/api";
import { parseOwnerOpen } from "../owner/owner";
import { runRead } from "../sidebar/agents";

/**
 * The times of the owner's messages in one chat, kept from the feed's splices.
 * `leftAt` is the message before the last one: the last one is the question that the digest answers.
 */
export class OwnerTimes {
  private rows: (number | null)[] = [];

  splice(at: number, rows: FeedRow[]): void {
    this.rows = this.rows.slice(0, at).concat(rows.map((r) => (r.k === "user" && typeof r.ts === "number" ? r.ts : null)));
  }

  leftAt(): number | null {
    const times = this.rows.filter((t): t is number => t !== null);
    return times.at(-2) ?? times.at(-1) ?? null;
  }
}

function jsonList(out: string): Record<string, unknown>[] | null {
  try {
    const list: unknown = JSON.parse(out);
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

/** The live workers of this coordinator that work now (`agents ls --all --json`). null: the tool gave no list. */
export function countBusy(out: string, parent: string): number | null {
  return jsonList(out)?.filter((w) => w?.parent === parent && w.live === true && w.status === "working").length ?? null;
}

/** The open owner questions and to-dos of this coordinator (`owner open --json`). null: the tool gave no list. */
export function countWaiting(out: string, coordinator: string): number | null {
  if (!jsonList(out)) return null;
  const items = parseOwnerOpen(out);
  return [...items.questions, ...items.todos].filter((i) => i.coordinator === coordinator).length;
}

const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "STARTUP_FAILURE"]);

/** The open PRs with a failed check on their head (`gh pr list --json statusCheckRollup`). null: gh gave no list. */
export function countFailing(out: string): number | null {
  return (
    jsonList(out)?.filter((pr) => Array.isArray(pr?.statusCheckRollup) && (pr.statusCheckRollup as Record<string, unknown>[]).some((c) => FAILED.has(String(c?.conclusion ?? c?.state)))).length ?? null
  );
}

/** gh's search for the PRs merged at or after `since`. */
export const mergedArgs = (since: number): string[] => ["pr", "list", "--state", "merged", "--search", `merged:>=${new Date(since).toISOString().replace(/\.\d{3}Z$/, "Z")}`, "--json", "number", "--limit", "100"];
export const failingArgs = ["pr", "list", "--state", "open", "--json", "number,statusCheckRollup", "--limit", "100"];

/** One read-only run of gh (in the agent's repository) and of the tool. A source that fails gives null for its counts. */
export async function readDigest(p: { orch: string; gh: string; cwd: string | null; terminal: string; since: number | null }): Promise<Digest> {
  const gh = (args: string[]) => (p.cwd ? runRead(p.gh, args, p.cwd).then((r) => (r.error ? "" : r.out)) : Promise.resolve(""));
  const [merged, failing, workers, owner] = await Promise.all([
    p.since === null ? Promise.resolve("") : gh(mergedArgs(p.since)),
    gh(failingArgs),
    runRead(p.orch, ["agents", "ls", "--all", "--json"]),
    runRead(p.orch, ["owner", "open", "--json"]),
  ]);
  return {
    since: p.since,
    merged: jsonList(merged)?.length ?? null,
    busy: workers.error ? null : countBusy(workers.out, p.terminal),
    waiting: owner.error ? null : countWaiting(owner.out, p.terminal),
    failing: countFailing(failing),
  };
}
