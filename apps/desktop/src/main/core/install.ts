import { execFile } from "node:child_process";

/** The start install (rows 6 to 8 of rule R1) must end in this time. */
export const CORE_INSTALL_TIMEOUT_MS = 60_000;

/** The end of one program run: the exit code (null when it did not exit), its output and the process error. */
export interface RunResult {
  code: number | null;
  output: string;
  error: string | null;
}

export type Run = (file: string, args: string[], options: { env: NodeJS.ProcessEnv; timeout: number }) => Promise<RunResult>;

/** Runs a program that answers in plain text (not JSON Lines), with its stdout and stderr in one text. */
export const runText: Run = (file, args, { env, timeout }) =>
  new Promise((resolve) => {
    execFile(file, args, { env, timeout, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : null) : 0;
      resolve({ code, output: `${stdout ?? ""}\n${stderr ?? ""}`, error: err ? err.message : null });
    });
  });

/** The text of a failed install: the `STOP:` line, else the last line of the output, else the process error. */
export function installMessage(result: RunResult): string {
  const lines = result.output.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => l.startsWith("STOP:")) ?? lines.at(-1) ?? result.error ?? `exit ${result.code}`;
}

/**
 * Installs the bundle's core into the root: `install --backend --helper <helper> [--orch <orch>]` with `CONTR_HOME=<root>`.
 * Exit 0 is done; 1 is stopped, 2 is bad arguments.
 */
export async function installCore(
  helper: string,
  orch: string | null,
  root: string,
  run: Run = runText,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const args = ["install", "--backend", "--helper", helper, ...(orch ? ["--orch", orch] : [])];
  const result = await run(helper, args, { env: { ...env, CONTR_HOME: root }, timeout: CORE_INSTALL_TIMEOUT_MS });
  return result.code === 0 ? { ok: true } : { ok: false, message: installMessage(result) };
}
