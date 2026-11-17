import type { TabTitle } from "../../shared/api";
import { readHcList, runRead } from "../sidebar/agents";

/** The title of an hc terminal from `hc get --json`: its `title`, else its `name`, else the terminal address. */
export function readTitle(json: string, terminal: string): string {
  try {
    const t = JSON.parse(json) as { title?: unknown; name?: unknown };
    if (typeof t.title === "string" && t.title !== "") return t.title;
    if (typeof t.name === "string" && t.name !== "") return t.name;
  } catch {
    // Not JSON: hc failed. Use the address.
  }
  return terminal;
}

/** Program names by hc `agent` kind. */
const PROGRAMS: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex" };

/** A tab's title from `hc get --json`: its `title`, else the program name from `agent`, else "Terminal". Never the address. */
export function readTabTitle(json: string): string {
  try {
    const t = JSON.parse(json) as { title?: unknown; agent?: unknown };
    if (typeof t.title === "string" && t.title !== "") return t.title;
    if (typeof t.agent === "string" && PROGRAMS[t.agent]) return PROGRAMS[t.agent];
  } catch {
    // Not JSON: hc failed.
  }
  return "Terminal";
}

/**
 * Reads a tab's title once with `hc get --json` (read-only). CONTR_HC picks the hc program.
 * When `hc get` fails, `hc ls --json` tells why: the terminal is `gone` only when hc runs and does not list it.
 * When hc itself fails (no core, no answer), the answer is an `error` and the tab stays.
 */
export async function tabTitle(terminal: string, hc = process.env.CONTR_HC ?? "hc"): Promise<TabTitle> {
  const get = await runRead(hc, ["get", "--json", terminal]);
  if (!get.error) return { title: readTabTitle(get.out) };
  const ls = await runRead(hc, ["ls", "--json"]);
  const { terms, error } = readHcList(ls.out, ls.error);
  if (error) return { error };
  return terms.some((t) => t.address === terminal) ? { error: get.error } : { gone: true };
}
