import type { SidebarAgent, WorkerState } from "../../shared/api";

/** Each agent's last state and when it changed (ms). hc and the orchestration tool give no change time, so the app stamps one. */
export type Changes = Record<string, { s: WorkerState; at: number }>;

const KEY = "sidebar.changed";
const KEEP_MS = 30 * 86_400_000;

function walk(list: SidebarAgent[], out: SidebarAgent[] = []): SidebarAgent[] {
  for (const a of list) {
    out.push(a);
    walk(a.workers, out);
  }
  return out;
}

/**
 * Stamps the agents whose state changed. Done and idle count as one: hc turns done into idle when the owner looks
 * at the agent, and that is not the agent doing something. A first sight is a change. Entries of agents gone for 30 days go.
 */
export function track(prev: Changes, agents: SidebarAgent[], now: number): Changes {
  const next: Changes = {};
  const listed = new Set<string>();
  for (const a of walk(agents)) {
    listed.add(a.terminal);
    const s = a.state === "done" ? "idle" : a.state;
    next[a.terminal] = prev[a.terminal]?.s === s ? prev[a.terminal] : { s, at: now };
  }
  for (const [k, c] of Object.entries(prev)) if (!listed.has(k) && now - c.at <= KEEP_MS) next[k] = c;
  return next;
}

/** "<1m", "5m", "3h", "2d". */
export function duration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/** The changes kept across restarts, in localStorage. */
export function load(): Changes {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Changes) : {};
  } catch {
    return {};
  }
}

export function save(c: Changes): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}

/** A worker row's tooltip: "name · #issue · work", each part only when known; none when it is the name alone. */
export function tip(a: SidebarAgent): string {
  const work = a.title !== a.name && a.title !== a.terminal ? a.title : null;
  const issue = a.issue ? (/^\d+$/.test(a.issue) ? `#${a.issue}` : a.issue) : null;
  const parts = [a.name, issue, work].filter(Boolean);
  return parts.length > 1 ? parts.join(" · ") : "";
}
