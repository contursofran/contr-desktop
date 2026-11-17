import type { coreOrder } from "./build";

export interface PickInput {
  /** The core's root, or null when the core logic is off. */
  root: string | null;
  /** The root is shared with the Herdr app. */
  shared: boolean;
  /** The owner said yes to this shared root. */
  allowed: boolean;
  /** `<root>/bin/herdr-contr-feed` exists. */
  homeHelper: boolean;
  order: ReturnType<typeof coreOrder>;
}

export interface Pick {
  source: "home" | "bundle";
  /** `install`: the bundle's core goes into the root first (rows 6 to 8). */
  action: "none" | "install";
  shared: boolean;
}

/** Which core the app runs (rule R1, rows 5 to 9). Row 10 (a home that does not start) is the caller's. */
export function pickCore(input: PickInput): Pick {
  const { root, shared, allowed, homeHelper, order } = input;
  if (root === null) return { source: "bundle", action: "none", shared: false };
  if (shared && !allowed) return { source: "bundle", action: "none", shared: true };
  if (!homeHelper || order === "older") return { source: "home", action: "install", shared };
  return { source: "home", action: "none", shared };
}
