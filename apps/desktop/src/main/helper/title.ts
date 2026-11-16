import { execFile } from "node:child_process";

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

/** Reads the terminal's title once with `hc get --json` (read-only). CONTR_HC picks the hc program. */
export function terminalTitle(terminal: string, hc = process.env.CONTR_HC ?? "hc"): Promise<string> {
  return new Promise((resolve) => {
    execFile(hc, ["get", "--json", terminal], { timeout: 5000 }, (_error, stdout) => resolve(readTitle(String(stdout ?? ""), terminal)));
  });
}
