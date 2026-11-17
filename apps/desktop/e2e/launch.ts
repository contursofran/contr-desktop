import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Starts the app for e2e. CONTR_E2E=1 keeps the app in the background:
 * no activation, no Dock icon, and the window never shows. Every spec launches here,
 * with its own scratch user data folder, so no run sees the localStorage of another.
 * A spec that passes `dataDir` keeps its user data over two launches.
 * A spec that sets no CONTR_ORCH gets the fake orchestration tool with no workers and no owner items:
 * no run reads the owner's file or runs the real tool.
 * A spec that sets no CONTR_TERMINAL gets "t1": the app has no default agent. `CONTR_TERMINAL: ""` launches with none.
 * The core's switches come from the spec only, never from the shell: with no CONTR_CORE_HOME the core logic is off,
 * and a CONTR_CORE_HOME must be in the temp folder, so no run reads or writes a core folder under home.
 */
export function launchApp(env: Record<string, string> = {}, dataDir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"))) {
  const shell = { ...process.env };
  delete shell.CONTR_CORE_HOME;
  delete shell.CONTR_CORE_BUNDLE;
  const core = env.CONTR_CORE_HOME;
  if (core !== undefined && !path.resolve(core).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error(`CONTR_CORE_HOME must be in ${os.tmpdir()}: ${core}`);
  return electron.launch({
    args: [".", `--user-data-dir=${dataDir}`],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...shell,
      CONTR_E2E: "1",
      CONTR_TERMINAL: "t1",
      ...(env.CONTR_ORCH ? {} : { CONTR_ORCH: path.resolve(import.meta.dirname, "fake-orch.mjs"), FAKE_ORCH_NONE: "1" }),
      ...env,
    },
  });
}
