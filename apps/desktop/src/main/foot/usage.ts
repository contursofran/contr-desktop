import type { Machine, UsageRow } from "../../shared/api";
import type { HelperLine } from "../helper/run";

interface Window {
  kind?: unknown;
  used_percent?: unknown;
  resets_at?: unknown;
}

const KIND: Record<string, string> = { five_hour: "5h", seven_day: "wk", primary: "5h", secondary: "wk" };
const NAME: Record<string, string> = { claude: "Claude", codex: "Codex" };

/** Time to a reset: minutes under an hour, hours under a day, else days. */
export function untilReset(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

/**
 * One row per plan from the helper's `usage` line, Claude then Codex: the most used current window as
 * "41% wk · 4d" (whole percent used, window, time to its reset). A window past its reset, or without a
 * number, has no known value: when no window is current, the row is stale ("—", no percent).
 */
export function usageRows(lines: HelperLine[], now: number): UsageRow[] {
  const usage = lines.find((l) => l.type === "usage");
  const plans = Array.isArray(usage?.plans) ? (usage.plans as { plan?: unknown; windows?: unknown; read_at?: unknown }[]) : [];
  const rows: UsageRow[] = [];
  for (const p of plans) {
    if (typeof p.plan !== "string" || !Array.isArray(p.windows) || p.windows.length === 0) continue;
    const plan = NAME[p.plan] ?? p.plan;
    const readAt = typeof p.read_at === "number" ? p.read_at * 1000 : null;
    const current = (p.windows as Window[]).flatMap((w) => {
      const at = typeof w.resets_at === "number" ? w.resets_at : null;
      if ((at !== null && at <= now) || typeof w.used_percent !== "number") return [];
      return [{ kind: typeof w.kind === "string" ? (KIND[w.kind] ?? w.kind) : "?", used: Math.round(w.used_percent), left: at === null ? null : at - now }];
    });
    if (current.length === 0) {
      rows.push({ plan, percent: null, value: "—", readAt });
      continue;
    }
    const top = current.reduce((a, b) => (b.used > a.used ? b : a));
    const value = `${top.used}% ${top.kind}${top.left === null ? "" : ` · ${untilReset(top.left)}`}`;
    rows.push({ plan, percent: top.used, value, readAt });
  }
  return rows;
}

/** hc's machines (`hc machine ls --json`), without temporary ones. Broken output: none. */
export function parseMachines(out: string): Machine[] {
  try {
    const list = (JSON.parse(out) as { machines?: { name?: unknown; state?: unknown; temporary?: unknown }[] }).machines ?? [];
    return list
      .filter((m) => typeof m.name === "string" && !m.temporary)
      .map((m) => ({ name: m.name as string, state: typeof m.state === "string" ? m.state : "connected" }));
  } catch {
    return [];
  }
}
