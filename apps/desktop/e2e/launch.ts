import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Starts the app for e2e. CONTR_E2E=1 keeps the app in the background:
 * no activation, no Dock icon, and the window never shows. Every spec launches here,
 * with its own scratch user data folder, so no run sees the localStorage of another.
 */
export function launchApp(env: Record<string, string> = {}) {
  return electron.launch({
    args: [".", `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"))}`],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, CONTR_E2E: "1", ...env },
  });
}
