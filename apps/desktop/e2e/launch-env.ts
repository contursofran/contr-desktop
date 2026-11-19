import { existsSync, realpathSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const e2e = import.meta.dirname;
/** The repository root. Its `bin/` holds the real core programs (scripts/fetch-helper), so no switch may name them. */
const repo = path.resolve(e2e, "../../..");

/** The switch of each outside program that the main process starts, and its fake in this folder. */
export const FAKES = {
  CONTR_CODEX: path.join(e2e, "fake-codex.mjs"),
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  CONTR_GH: path.join(e2e, "fake-gh.mjs"),
} as const;

export interface LaunchOptions {
  /**
   * Runs the real `hc` (from PATH) against this scratch session, in place of the fake hc. Only `terminal.spec.ts` uses it:
   * it starts that session and stops it after. The launcher sets `CONTR_HC`, `HC_SESSION` and `CONTR_HC_SESSION`, so every
   * hc call of the app goes to the scratch session, never to the default one.
   */
  realHcSession?: string;
}

const inside = (file: string, dir: string) => file.startsWith(dir + path.sep);

/** The allowed folders, as given and with links resolved (on macOS the temp folder is a link into /private). */
function roots(): { allowed: string[]; denied: string[] } {
  const both = (dir: string) => [...new Set([path.resolve(dir), realpathSync(dir)])];
  const bin = path.join(repo, "bin");
  return { allowed: [...both(repo), ...both(os.tmpdir())], denied: existsSync(bin) ? both(bin) : [bin] };
}

/**
 * Throws unless `value` is an absolute path inside the repository or the temp folder, and not in the repository's
 * `bin/`. An existing path must be a file, and its real path (links resolved) must obey the same rule. A path that does
 * not exist is allowed (a spec of a missing program): it runs nothing.
 */
export function checkProgram(name: string, value: string): void {
  const { allowed, denied } = roots();
  const ok = (file: string) => allowed.some((d) => inside(file, d)) && !denied.some((d) => inside(file, d));
  if (!path.isAbsolute(value) || !ok(path.resolve(value))) throw new Error(`${name} must be a file in the repository or ${os.tmpdir()}, not in bin/: ${value}`);
  if (!existsSync(value)) return;
  const real = realpathSync(value);
  if (!statSync(real).isFile() || !ok(real)) throw new Error(`${name} must be a file in the repository or ${os.tmpdir()}, not in bin/: ${value} (${real})`);
}

/**
 * The environment of an e2e run. Each program switch gets its fake unless the spec names another fake; the shell's
 * values of these switches are dropped, so no run reaches the real hc, helper, tool, git or gh by leaving a switch out.
 * With `CONTR_CORE_BUNDLE` the helper comes from the core's bundle or home (both in the temp folder), so the fake
 * helper is not set then. The orchestration tool's fake lists no workers and no owner items unless the spec names it.
 * A spec that sets no CONTR_TERMINAL gets "t1"; `CONTR_TERMINAL: ""` launches with none.
 */
export function launchEnv(env: Record<string, string> = {}, shell: NodeJS.ProcessEnv = process.env, options: LaunchOptions = {}): Record<string, string> {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(shell)) if (v !== undefined) base[k] = v;
  for (const k of [...Object.keys(FAKES), "CONTR_CORE_HOME", "CONTR_CORE_BUNDLE", "CONTR_HC_SESSION"]) delete base[k];

  const core = env.CONTR_CORE_HOME;
  if (core !== undefined && !inside(path.resolve(core), path.resolve(os.tmpdir()))) throw new Error(`CONTR_CORE_HOME must be in ${os.tmpdir()}: ${core}`);
  const bundle = env.CONTR_CORE_BUNDLE;
  if (bundle !== undefined && !inside(path.resolve(bundle), path.resolve(os.tmpdir()))) throw new Error(`CONTR_CORE_BUNDLE must be in ${os.tmpdir()}: ${bundle}`);
  if (core !== undefined && bundle === undefined) throw new Error("CONTR_CORE_HOME needs CONTR_CORE_BUNDLE: else the core install runs the real helper in bin/");

  const programs: Record<string, string> = {};
  for (const [k, fake] of Object.entries(FAKES)) {
    const value = env[k] ?? (k === "CONTR_HELPER" && bundle !== undefined ? undefined : fake);
    if (value === undefined) continue;
    checkProgram(k, value);
    programs[k] = value;
  }

  const session = options.realHcSession;
  let hc: Record<string, string> = {};
  if (session !== undefined) {
    if (!/^[A-Za-z0-9_-]+$/.test(session)) throw new Error(`realHcSession must be a scratch session name: "${session}"`);
    for (const k of ["CONTR_HC", "HC_SESSION", "CONTR_HC_SESSION"]) if (k in env) throw new Error(`realHcSession sets ${k}: the spec must not`);
    hc = { CONTR_HC: "hc", HC_SESSION: session, CONTR_HC_SESSION: session };
  }

  return {
    ...base,
    CONTR_E2E: "1",
    CONTR_TERMINAL: "t1",
    ...(env.CONTR_ORCH ? {} : { FAKE_ORCH_NONE: "1" }),
    ...env,
    ...programs,
    ...hc,
  };
}
