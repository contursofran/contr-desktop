import path from "node:path";

/** Where the core's root came from: a switch or `CONTR_HOME` (custom), the neutral folders, or the Herdr app's folder. */
export type RootKind = "custom" | "neutral" | "old-neutral" | "herdr";

export interface CoreRoot {
  root: string;
  kind: RootKind;
}

/**
 * The core's root (contr-core decision 3). `CONTR_CORE_HOME` comes first. An e2e run or a dev run with no
 * `CONTR_CORE_HOME` has no root: the core logic is off, and no folder under `home` is read.
 * Else `CONTR_HOME`, `$HERDR_APP_HOME/herdr-contr`, then the first of `~/.config/contr-core`,
 * `~/.config/contr-backend`, `~/.config/herdr-app/herdr-contr` that exists, else `~/.config/contr-core`.
 */
export function coreRoot(env: NodeJS.ProcessEnv, home: string, exists: (dir: string) => boolean, e2e: boolean, packaged: boolean): CoreRoot | null {
  if (env.CONTR_CORE_HOME) return { root: env.CONTR_CORE_HOME, kind: "custom" };
  if (e2e || !packaged) return null;
  if (env.CONTR_HOME) return { root: env.CONTR_HOME, kind: "custom" };
  if (env.HERDR_APP_HOME) return { root: path.join(env.HERDR_APP_HOME, "herdr-contr"), kind: "herdr" };
  const config = path.join(home, ".config");
  const neutral = path.join(config, "contr-core");
  const found: CoreRoot[] = [
    { root: neutral, kind: "neutral" },
    { root: path.join(config, "contr-backend"), kind: "old-neutral" },
    { root: herdrRoot(home), kind: "herdr" },
  ];
  return found.find((r) => exists(r.root)) ?? { root: neutral, kind: "neutral" };
}

/** The Herdr app's core folder. */
export function herdrRoot(home: string): string {
  return path.join(home, ".config", "herdr-app", "herdr-contr");
}

/** What the app needs from `<root>/install.json`: the build stamp and the number of the mod's file records. */
export interface InstallRecord {
  build: string | null;
  modFiles: number;
}

/**
 * True when the Herdr app uses this root too (rule R1): its `install.json` has a `files` record (an install of
 * the Herdr mod), or it is the Herdr app's folder by real path (`home move`). `realpath` gives null for no folder.
 */
export function sharedWithHerdr(
  root: string,
  readRecord: (root: string) => InstallRecord | null,
  realpath: (p: string) => string | null,
  home: string,
): boolean {
  if ((readRecord(root)?.modFiles ?? 0) > 0) return true;
  const herdr = realpath(herdrRoot(home));
  return herdr !== null && herdr === realpath(root);
}
