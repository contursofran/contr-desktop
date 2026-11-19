import { existsSync } from "node:fs";
import path from "node:path";
import { binPath } from "../helper/binPath";

export interface CurrentCore {
  source: "home" | "bundle";
  /** The core's root, or null when the core logic is off. */
  root: string | null;
  /** Why the app runs the bundle in place of the home (texts T8, T9), else null or not set. */
  error?: string | null;
  /** The root is shared with the Herdr app: the app changes nothing there (rule R1, row 5). */
  shared?: boolean;
}

let current: CurrentCore = { source: "bundle", root: null };

/** Sets the core that the app runs (startCore). */
export function setCore(core: CurrentCore): void {
  current = core;
}

export function currentCore(): CurrentCore {
  return current;
}

/** The bundled program path, with a substitute bundle only in e2e. */
export function coreBundlePath(name: string, appRoot: string, env = process.env): string {
  return binPath(name, appRoot, undefined, env.CONTR_E2E === "1" ? env.CONTR_CORE_BUNDLE : undefined);
}

/**
 * The path of a core program: the override first; then `<root>/bin/<name>` when the app runs the home's core
 * and the file exists; else the bundled copy (binPath, or `CONTR_CORE_BUNDLE` in its place).
 */
export function corePath(name: string, appRoot: string, override: string | undefined, env = process.env): string {
  if (override) return override;
  if (current.source === "home" && current.root) {
    const home = path.join(current.root, "bin", name);
    if (existsSync(home)) return home;
  }
  return coreBundlePath(name, appRoot, env);
}
