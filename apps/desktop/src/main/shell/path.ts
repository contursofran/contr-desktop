import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/**
 * An app opened from Finder or the Dock gets the short macOS PATH, so hc and gh are not found.
 * The packaged app reads PATH from the owner's login shell at start, as t3code's desktop app does
 * (written for this repo, not copied).
 */
const START = "__CONTR_PATH_START__";
const END = "__CONTR_PATH_END__";

/** Gets the PATH value between the markers; shell startup output around it is ignored. */
export function parsePath(out: string): string | null {
  const a = out.indexOf(START);
  if (a < 0) return null;
  const b = out.indexOf(END, a + START.length);
  if (b < 0) return null;
  const v = out.slice(a + START.length, b).trim();
  return v || null;
}

/** Joins PATH lists in order and drops empty and duplicate entries. */
export function mergePath(...lists: (string | undefined | null)[]): string {
  const seen = new Set<string>();
  for (const l of lists) for (const p of (l ?? "").split(":")) if (p) seen.add(p);
  return [...seen].join(":");
}

export function fallbackDirs(home: string): string {
  return [path.join(home, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"].join(":");
}

export type RunShell = (shell: string, args: string[], timeoutMs: number) => string;

const runShell: RunShell = (shell, args, timeout) =>
  execFileSync(shell, args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] });

/** Reads PATH from the login shell (3 s timeout). Returns null and logs on failure. */
export function readLoginShellPath(shell: string, run: RunShell = runShell): string | null {
  try {
    return parsePath(run(shell, ["-ilc", `printf '%s' "${START}$PATH${END}"`], 3000));
  } catch (e) {
    console.error(`contr: cannot read PATH from ${shell}: ${(e as Error).message}`);
    return null;
  }
}

/** Sets env.PATH to the login shell's PATH, then the current PATH, then the fallback dirs. */
export function syncShellPath(env: NodeJS.ProcessEnv = process.env, run?: RunShell): string {
  const shellPath = readLoginShellPath(env.SHELL || "/bin/zsh", run);
  env.PATH = mergePath(shellPath, env.PATH, fallbackDirs(env.HOME || os.homedir()));
  return env.PATH;
}
