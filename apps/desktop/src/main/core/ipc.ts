import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { CORE_CHANNEL, CORE_CHECK_CHANNEL, CORE_EVENT, type CoreState } from "../../shared/api";
import { binPath } from "../helper/binPath";
import { helperPath } from "../helper/run";
import { afterCheck, singleFlight } from "../update/check";
import { CHECK_MS } from "../update/ipc";
import { readBundleTag, readInstalled, stampOfTag } from "./build";
import { checkView, coreCheckFailed, runCoreCheck } from "./check";
import type { CurrentCore } from "./current";

/** The version that the app runs before a check: the home's build, or the bundle's stamp. */
function startVersion(appRoot: string, start: CurrentCore): string {
  if (start.source === "home" && start.root) {
    const build = readInstalled(start.root)?.build;
    if (build) return build;
  }
  const stamp = stampOfTag(readBundleTag(path.dirname(binPath("herdr-contr-feed", appRoot, undefined, process.env.CONTR_CORE_BUNDLE))));
  return stamp ? `${stamp.sha} ${stamp.date}` : "Unknown";
}

/**
 * Settings > Core (docs/reference/releases.md, "The Core part"). The helper's `update check` reads the core's
 * newest release; the app reads no GitHub API for the core. It runs at start and on each open of Settings (the
 * core's day cache answers), and with `--force` on Check now and every 6 hours (CHECK_MS: GitHub has no release event).
 * With no root (dev, e2e with no CONTR_CORE_HOME) the part says "Development build"; a shared root is not checked.
 * The start's error (a failed install, a home that does not start) stays until a check fails.
 */
export function registerCoreIpc(appRoot: string, start: CurrentCore): { check: (force: boolean) => Promise<void> } {
  const shared = start.shared === true;
  const startError = start.error ?? null;
  const state: CoreState = {
    current: startVersion(appRoot, start),
    dev: start.root === null,
    latest: null,
    available: false,
    progress: null,
    downloaded: null,
    ready: false,
    error: startError,
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
  let force = false;
  const once = singleFlight(async () => {
    const root = state.root;
    if (root === null || shared) return;
    set({ checking: true });
    const read = await runCoreCheck(helperPath(appRoot), root, force);
    if ("error" in read) return set({ checking: false, checked: Date.now(), checkFailed: true, error: coreCheckFailed(read.error) });
    const v = checkView(read);
    const { change } = afterCheck(state, v.latest, true, v.available, Date.now());
    // For the bundle, `installed` is the root's build, not the copy that runs: the start's stamp stays.
    set({ ...change, ...(state.source === "home" ? { current: v.current } : {}), checkFailed: false, error: startError });
  });
  /** A call while a check runs waits for that check (singleFlight), forced or not. */
  const check = (f: boolean) => {
    force = f;
    return once();
  };
  ipcMain.handle(CORE_CHANNEL, () => ({ ...state }));
  ipcMain.handle(CORE_CHECK_CHANNEL, (_e, f: boolean) => check(f === true));
  void check(false);
  if (state.root !== null && !shared) setInterval(() => void check(true), CHECK_MS);
  return { check };
}
