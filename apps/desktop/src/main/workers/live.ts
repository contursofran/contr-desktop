/** One rule for an agent's live workers, used by the status line and the sidebar (decision in docs/decisions). */

interface HcTerminal {
  address?: unknown;
  parent?: unknown;
  state?: unknown;
  status?: unknown;
}

interface OrchEntry {
  address?: unknown;
  parent?: unknown;
  live?: unknown;
}

function list<T>(json: string, key?: string): T[] {
  try {
    const v = JSON.parse(json) as unknown;
    const l = key ? (v as Record<string, unknown>)?.[key] : v;
    return Array.isArray(l) ? (l as T[]) : [];
  } catch {
    return [];
  }
}

/** An hc terminal that is an agent now: live, with a `status` (a shell has none). */
export function isLiveAgent(t: HcTerminal): boolean {
  return typeof t?.address === "string" && t.address !== "" && t.state === "live" && t.status != null;
}

/**
 * The parent of each live worker, by address, from `hc ls --json` and `agents ls --all --json`.
 * A worker is a live hc terminal with a parent; it needs no `status` (a worker that has just started has none yet), as
 * herdr-contr-spaces `workers()`. Its parent is its orchestration-tool `parent`, else its hc `parent`.
 * An orchestration-tool entry for the address with `live` not true removes it (the tool says it is stopped).
 * A tool entry with no terminal in hc is not a worker.
 */
export function liveWorkerParents(hcJson: string, orchJson: string): Map<string, string> {
  const orch = new Map<string, OrchEntry>();
  for (const o of list<OrchEntry>(orchJson)) if (typeof o?.address === "string") orch.set(o.address, o);
  const out = new Map<string, string>();
  for (const t of list<HcTerminal>(hcJson, "terminals")) {
    if (typeof t?.address !== "string" || t.address === "" || t.state !== "live") continue;
    const address = t.address as string;
    const o = orch.get(address);
    if (o && o.live !== true) continue;
    const parent = typeof o?.parent === "string" && o.parent !== "" ? o.parent : typeof t.parent === "string" && t.parent !== "" ? t.parent : null;
    if (parent && parent !== address) out.set(address, parent);
  }
  return out;
}

/** The number of live workers of an agent. */
export function countLiveWorkers(hcJson: string, orchJson: string, parent: string): number {
  let n = 0;
  for (const p of liveWorkerParents(hcJson, orchJson).values()) if (p === parent) n++;
  return n;
}
