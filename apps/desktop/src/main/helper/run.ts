import { execFile } from "node:child_process";
import { corePath } from "../core/current";

export interface HelperLine {
  type: string;
  [field: string]: unknown;
}

/** The helper path: CONTR_HELPER, else the home's helper when the app runs the home's core, else the bundled one (see corePath). */
export function helperPath(appRoot: string, env = process.env): string {
  return corePath("herdr-contr-feed", appRoot, env.CONTR_HELPER, env);
}

/**
 * Runs one helper command. The helper answers and exits (one call per command).
 * The timeout is 30 s unless `options.timeout` says another.
 * A broken answer (no header or no end) gives an `error` line with code `helper`.
 */
export function runHelper(helper: string, args: string[], options: { timeout?: number } = {}): Promise<HelperLine[]> {
  return new Promise((resolve) => {
    execFile(helper, args, { timeout: options.timeout ?? 30_000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      const lines = parseLines(stdout ?? "");
      if (lines[0]?.type !== "header" || lines.at(-1)?.type !== "end") {
        const message = err ? err.message : "the helper gave no header and end line";
        resolve([{ type: "error", code: "helper", message }]);
      } else resolve(lines);
    });
  });
}

export function parseLines(text: string): HelperLine[] {
  const out: HelperLine[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as HelperLine;
      if (value && typeof value.type === "string") out.push(value);
    } catch {
      // A line that is not JSON is ignored; header and end decide if the answer is whole.
    }
  }
  return out;
}
