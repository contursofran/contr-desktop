// Adapted from t3code apps/desktop/src/updates/updateMachine.ts at
// 5b265f8eb7db05df055b2e882d4c10d332076d6b (MIT). The start and failure reducers
// use the core's install flag and keep the available update for a retry.
import path from "node:path";
import type { CoreState } from "../../shared/api";
import { runHelper, type HelperLine } from "../helper/run";
import { coreFailText } from "./check";

export const CORE_UPDATE_TIMEOUT_MS = 600_000;

export function updateArgs(root: string): string[] {
  return ["update", "install", ...(path.basename(root) === "herdr-contr" ? ["--home", path.dirname(path.resolve(root))] : [])];
}

export function readUpdateDone(lines: HelperLine[]): { installed: string; version: string | null } | { error: string } {
  const error = lines.find((line) => line.type === "error");
  if (error) {
    return { error: error.code === "usage"
      ? "This core cannot update itself yet. Install a newer contr app."
      : coreFailText(error.code, error.message) };
  }
  const done = lines.find((line) => line.type === "update-done");
  if (!done || typeof done.installed !== "string") return { error: "the helper gave no update-done line" };
  return { installed: done.installed, version: typeof done.version === "string" ? done.version : null };
}

export function reduceCoreUpdateOnStart(state: CoreState): CoreState {
  return {
    ...state,
    installing: true,
    error: null,
    checkFailed: false,
  };
}

export function reduceCoreUpdateOnFailure(state: CoreState, message: string): CoreState {
  return {
    ...state,
    installing: false,
    error: message,
  };
}

export async function runCoreUpdate(helper: string, root: string, run = runHelper) {
  return readUpdateDone(await run(helper, updateArgs(root), {
    env: { ...process.env, CONTR_HOME: root },
    timeout: CORE_UPDATE_TIMEOUT_MS,
  }));
}
