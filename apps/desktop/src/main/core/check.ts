import { runHelper, type HelperLine } from "../helper/run";

/** The core's `update` line, read (C2 fields are null when the core has none). */
export interface CoreCheck {
  installed: string;
  newest: string;
  differs: boolean;
  /** Seconds. */
  checkedAt: number;
  installedVersion: string | null;
  newestVersion: string | null;
  newer: boolean | null;
  releases: { version: string; tag: string; date: string; changes: string[] }[] | null;
}

/** T10: the codes `no-gh` and `gh` (a core from before C2 reads the releases with gh). */
export const NO_GH = "GitHub CLI (gh) is not installed or not logged in.";
/** T4. */
export const coreCheckFailed = (message: string) => `Core check failed: ${message}`;

/** The text of a core error: `no-gh` and `gh` give T10; else the message. */
export function coreFailText(code: unknown, message: unknown): string {
  if (code === "no-gh" || code === "gh") return NO_GH;
  return typeof message === "string" && message ? message : String(code ?? "unknown error");
}

const text = (v: unknown) => (typeof v === "string" ? v : null);

/** The answer of `update check`: the `update` line, else the error's text. No update line is an error. */
export function readUpdateLine(lines: HelperLine[]): CoreCheck | { error: string } {
  const error = lines.find((l) => l.type === "error");
  if (error) return { error: coreFailText(error.code, error.message) };
  const u = lines.find((l) => l.type === "update");
  if (!u || typeof u.installed !== "string" || typeof u.newest !== "string") return { error: "the helper gave no update line" };
  return {
    installed: u.installed,
    newest: u.newest,
    differs: u.differs === true,
    checkedAt: typeof u.checked_at === "number" ? u.checked_at : 0,
    installedVersion: text(u.installed_version),
    newestVersion: text(u.newest_version),
    newer: typeof u.newer === "boolean" ? u.newer : null,
    releases: Array.isArray(u.releases) ? (u.releases as CoreCheck["releases"]) : null,
  };
}

/** What Settings > Core shows of a check: the version (C2) else the stamp, and `newer` (C2) else `differs`. */
export function checkView(c: CoreCheck): { current: string; latest: string; available: boolean } {
  return { current: c.installedVersion ?? c.installed, latest: c.newestVersion ?? c.newest, available: c.newer ?? c.differs };
}

/** The arguments of `update check`: `--force` asks GitHub again (Check now, the 6-hour timer), else the core's day cache answers. */
export const checkArgs = (force: boolean) => ["update", "check", ...(force ? ["--force"] : [])];

/** Runs `update check` for the root with `CONTR_HOME=<root>`. */
export async function runCoreCheck(helper: string, root: string, force: boolean, run = runHelper, env = process.env): Promise<CoreCheck | { error: string }> {
  return readUpdateLine(await run(helper, checkArgs(force), { env: { ...env, CONTR_HOME: root } }));
}

/**
 * One check at a time, as `singleFlight`, but a forced call (Check now) is never lost: while an unforced check runs,
 * it waits for that check and then runs one forced check. A call while a forced check runs, or one is queued, joins it.
 */
export function forceFlight(run: (force: boolean) => Promise<void>): (force: boolean) => Promise<void> {
  let running: { done: Promise<void>; force: boolean } | null = null;
  let queued: Promise<void> | null = null;
  const start = (force: boolean): Promise<void> => {
    const done = run(force).finally(() => {
      if (running?.done === done) running = null;
    });
    running = { done, force };
    return done;
  };
  return (force) => {
    if (!running) return start(force);
    if (!force || running.force) return running.done;
    return (queued ??= running.done.then(() => {
      queued = null;
      return start(true);
    }));
  };
}
