/** One `contr-status` line: `<worker> | #<issue> | <what it builds>`. */
export interface StatusLine {
  worker: string;
  issue: number;
  text: string;
}

/** One `contr-queue` step: `#<n> <label>`, with ` -- <note>` for a dependency. */
export interface QueueStep {
  number: number;
  label: string;
  note: string | null;
}

function lines(code: string): string[] {
  return code.split("\n").map((l) => l.trim()).filter((l) => l !== "");
}

/** The lines of a `contr-status` block, or null when one line does not parse (the block then shows as code). */
export function parseStatus(code: string): StatusLine[] | null {
  const out: StatusLine[] = [];
  for (const line of lines(code)) {
    const parts = line.split("|").map((p) => p.trim());
    const issue = /^#(\d+)$/.exec(parts[1] ?? "");
    if (parts.length !== 3 || !parts[0] || /\s/.test(parts[0]) || !issue || !parts[2]) return null;
    out.push({ worker: parts[0], issue: Number(issue[1]), text: parts[2] });
  }
  return out.length > 0 ? out : null;
}

/** The steps of a `contr-queue` block in order, or null when one line does not parse. */
export function parseQueue(code: string): QueueStep[] | null {
  const out: QueueStep[] = [];
  for (const line of lines(code)) {
    const m = /^#(\d+)\s+(.+?)(?:\s+--\s+(.+))?$/.exec(line);
    if (!m) return null;
    out.push({ number: Number(m[1]), label: m[2]!, note: m[3] ?? null });
  }
  return out.length > 0 ? out : null;
}

/** A `contr-digest` block has no lines: the app reads the counts. A block with text shows as code. */
export const parseDigest = (code: string): boolean => lines(code).length === 0;

/** A `contr-pr` block holds one PR number (`#31`); the app reads the rest. Other text: null, and the block shows as code. */
export function parsePr(code: string): number | null {
  const m = /^#?(\d+)$/.exec(lines(code).join(" "));
  return m ? Number(m[1]) : null;
}
