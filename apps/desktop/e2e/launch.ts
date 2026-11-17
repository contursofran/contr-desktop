import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchEnv, type LaunchOptions } from "./launch-env";

/**
 * Starts the app for e2e. CONTR_E2E=1 keeps the app in the background:
 * no activation, no Dock icon, and the window never shows. Every spec launches here,
 * with its own scratch user data folder, so no run sees the localStorage of another.
 * A spec that passes `dataDir` keeps its user data over two launches.
 * Each outside program (hc, the helper, the orchestration tool, git, gh) is a fake by default (launch-env.ts), and a
 * program switch must name a file in the repository or the temp folder. Only `options.realHcSession` runs the real hc,
 * on a scratch session.
 * The core's switches come from the spec only, never from the shell: with no CONTR_CORE_HOME the core logic is off,
 * and a CONTR_CORE_HOME must be in the temp folder, so no run reads or writes a core folder under home.
 */
export function launchApp(env: Record<string, string> = {}, dataDir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-")), options: LaunchOptions = {}) {
  return electron.launch({
    args: [".", `--user-data-dir=${dataDir}`],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: launchEnv(env, process.env, options),
  });
}
