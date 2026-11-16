import { _electron as electron } from "@playwright/test";
import path from "node:path";

/**
 * Starts the app for e2e. CONTR_E2E=1 keeps the app in the background:
 * no activation, no Dock icon, no focused window. Every spec launches here.
 */
export function launchApp(env: Record<string, string> = {}) {
  return electron.launch({
    args: ["."],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, CONTR_E2E: "1", ...env },
  });
}
