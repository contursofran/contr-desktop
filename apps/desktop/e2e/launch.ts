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
 */
export function launchApp(env: Record<string, string> = {}, dataDir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"))) {
  return electron.launch({
    args: [".", `--user-data-dir=${dataDir}`],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      CONTR_E2E: "1",
      ...(env.CONTR_ORCH ? {} : { CONTR_ORCH: path.resolve(import.meta.dirname, "fake-orch.mjs"), FAKE_ORCH_NONE: "1" }),
      ...env,
    },
  });
}
