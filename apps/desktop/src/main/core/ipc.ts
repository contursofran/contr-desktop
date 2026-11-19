import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { CORE_CHANNEL, CORE_CHECK_CHANNEL, CORE_EVENT, CORE_UPDATE_CHANNEL, type CoreState } from "../../shared/api";
import { restartFeeds } from "../helper";
import { helperPath } from "../helper/run";
import { afterCheck } from "../update/check";
import { CHECK_MS } from "../update/ipc";
import { readBundleTag, readInstalled, stampOfTag } from "./build";
import { checkView, coreCheckFailed, forceFlight, runCoreCheck } from "./check";
import { coreBundlePath, setCore, type CurrentCore } from "./current";
import { CORE_NOT_START, helperStarts } from "./start";
import { reduceCoreUpdateOnFailure, reduceCoreUpdateOnStart, runCoreUpdate } from "./update";

/** The version that the app runs before a check: the home's build, or the bundle's stamp. */
function startVersion(appRoot: string, start: CurrentCore): string {
  if (start.source === "home" && start.root) {
    const build = readInstalled(start.root)?.build;
    if (build) return build;
  }
  const stamp = stampOfTag(readBundleTag(path.dirname(coreBundlePath("herdr-contr-feed", appRoot))));
  return stamp ? `${stamp.sha} ${stamp.date}` : "Unknown";
}

/**
 * Settings > Core (docs/reference/releases.md, "The Core part"). The helper's `update check` reads the core's
 * newest release; the app reads no GitHub API for the core. It runs at start and on each open of Settings (the
 * core's day cache answers), and with `--force` on Check now and every 6 hours (CHECK_MS: GitHub has no release event).
 * With no root (dev, e2e with no CONTR_CORE_HOME) the part says "Development build"; a shared root is not checked.
 * A check failure takes precedence over a start or install error.
 */
export function registerCoreIpc(appRoot: string, start: CurrentCore): { check: (force: boolean) => Promise<void> } {
  const shared = start.shared === true;
  let coreError = start.error ?? null;
  const state: CoreState = {
    current: startVersion(appRoot, start),
    dev: start.root === null,
    latest: null,
    available: false,
    progress: null,
    downloaded: null,
    ready: false,
    error: coreError,
    checking: false,
    checked: null,
    checkFailed: false,
    root: start.root,
    source: start.source,
    shared,
    installing: false,
    updated: null,
  };
  const set = (change: Partial<CoreState>) => {
    Object.assign(state, change);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(CORE_EVENT, { ...state });
  };
  /** One check at a time; a Check now press during an unforced check runs a forced one after it (forceFlight). */
  const check = forceFlight(async (force) => {
    const root = state.root;
    if (root === null || shared || state.installing) return;
    set({ checking: true });
    const read = await runCoreCheck(helperPath(appRoot), root, force);
    if (state.installing) return set({ checking: false });
    if ("error" in read) return set({ checking: false, checked: Date.now(), checkFailed: true, error: coreCheckFailed(read.error) });
    const v = checkView(read);
    const { change } = afterCheck(state, v.latest, true, v.available, Date.now());
    // For the bundle, `installed` is the root's build, not the copy that runs: the start's stamp stays.
    set({ ...change, ...(state.source === "home" ? { current: v.current } : {}), checkFailed: false, error: coreError });
  });
  ipcMain.handle(CORE_UPDATE_CHANNEL, async () => {
    const root = state.root;
    if (root === null || shared || !state.available || state.installing) return;
    set(reduceCoreUpdateOnStart(state));
    // Let a check that already started finish before the installer changes the root.
    if (state.checking) await check(false);

    const done = await runCoreUpdate(helperPath(appRoot), root);
    if ("error" in done) {
      coreError = `Core update failed: ${done.error}`;
      set(reduceCoreUpdateOnFailure(state, coreError));
      return;
    }

    const source = await helperStarts(path.join(root, "bin", "herdr-contr-feed")) ? "home" : "bundle";
    coreError = source === "home" ? null : CORE_NOT_START;
    setCore({ source, root, error: coreError });
    restartFeeds();
    const updated = source === "home" ? done.version ?? done.installed : null;
    set({
      source,
      installing: false,
      updated,
      available: false,
      current: updated ?? startVersion(appRoot, { source, root }),
      error: coreError,
    });
    if (source === "home") await check(false);
  });
  ipcMain.handle(CORE_CHANNEL, () => ({ ...state }));
  ipcMain.handle(CORE_CHECK_CHANNEL, (_e, f: boolean) => check(f === true));
  void check(false);
  if (state.root !== null && !shared) setInterval(() => void check(true), CHECK_MS);
  return { check };
}
