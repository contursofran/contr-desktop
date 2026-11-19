import { app, BrowserWindow, ipcMain, shell } from "electron";
import { createWriteStream, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { CHANGELOG_CHANNEL, UPDATE_CHANNEL, UPDATE_CHECK_CHANNEL, UPDATE_DOWNLOAD_CHANNEL, UPDATE_EVENT, UPDATE_RESTART_CHANNEL, type UpdateState } from "../../shared/api";
import { changeLogSource } from "./changelog";
import { afterCheck, singleFlight } from "./check";
import { updateConfig } from "./config";
import { stageZip, startSwap, writable } from "./install";
import { getJson, newer, parseRelease, readReleaseFile, type Release, type ReleaseFile } from "./release";

/**
 * GitHub has no release event for an app: the newest release is read at start, every 6 hours, each time the
 * Settings view opens, on "Check now" and on the app menu's "Check for Updates…".
 */
export const CHECK_MS = 6 * 60 * 60_000;

/**
 * The Update button (owner decision, docs/decisions/80-auto-install.md). Only a packaged app checks; dev and e2e
 * show "Development build", unless CONTR_UPDATE_URL points the check at a fake release (e2e).
 * When the app's folder is writable and the release has the .zip, a press downloads and checks the new app,
 * and "Restart to update" swaps it in. Else a press downloads the .dmg into Downloads and opens it.
 * CONTR_INSTALL_DIR replaces the folder of the running app, CONTR_DOWNLOADS the Downloads folder.
 * With CONTR_E2E=1 nothing is opened, swapped or quit.
 * Settings > Change log reads the newest releases (docs/decisions/122-change-log.md) with each check;
 * CONTR_RELEASES_URL points it at a fake releases list (e2e). With CONTR_E2E=1, CONTR_VERSION replaces this app's
 * version, so a test can mark a release "Installed".
 * A check reads release.json first (docs/decisions/131-release-file.md): one read gives the release and the change
 * log, with no API rate limit. With no such file (HTTP 404) or a bad one, it reads the API as before.
 * CONTR_RELEASE_FILE_URL points it at a fake release.json (e2e); e2e with no such switch reads no release.json.
 */
export function registerUpdateIpc(): { check: () => Promise<void> } {
  const { e2e, url, file, releases, target, downloads } = updateConfig(process.env, app.isPackaged, () => app.getPath("exe"));
  const log = changeLogSource(releases, fetch, file);
  const current = (e2e && process.env.CONTR_VERSION) || app.getVersion();
  const state: UpdateState = { current, dev: url === null && file === null, latest: null, available: false, progress: null, downloaded: null, ready: false, error: null, checking: false, checked: null, checkFailed: false };
  let release: Release | null = null;
  let next: string | null = null;
  let restarting = false;
  const clearStage = () => {
    if (next) rmSync(path.dirname(next), { recursive: true, force: true });
    next = null;
  };
  app.once("will-quit", () => {
    if (!restarting) clearStage();
  });
  const set = (change: Partial<UpdateState>) => {
    Object.assign(state, change);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(UPDATE_EVENT, { ...state });
  };
  /** Installs from the .zip when the release has it and the app's folder is writable. */
  const zipUrl = (r: Release) => (r.zipUrl && target && writable(path.dirname(target)) ? r.zipUrl : null);
  /** One check at a time (singleFlight); see afterCheck for a check while a download runs or is ready. */
  const check = singleFlight(async () => {
    if (!url && !file) return void log.load();
    set({ checking: true });
    // The change log takes release.json's releases; with no release.json it reads on its own.
    const fromFile: Promise<ReleaseFile | null> = file ? readReleaseFile(file) : Promise.resolve(null);
    void fromFile.then((r) => (r ? log.put(r.releases) : void log.load()), () => void log.load());
    try {
      const read = await fromFile;
      if (!read && !url) throw new Error("The newest release has no release.json.");
      const found = read?.release ?? parseRelease(await getJson(url!));
      const { take, change } = afterCheck(state, found.version, zipUrl(found) !== null || found.dmgUrl !== null, newer(found.version, state.current), Date.now());
      if (take) release = found;
      // A release taken again makes an older "Opened …" line wrong; a running or ready download keeps its state.
      set({ ...change, checkFailed: false, ...(take ? { downloaded: null } : {}) });
    } catch (e) {
      set({ checking: false, checked: Date.now(), checkFailed: true, error: `Update check failed: ${(e as Error).message}` });
    }
  });
  const fetchTo = async (from: string, file: string) => {
    const res = await fetch(from);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    let got = 0;
    const count = new Transform({
      transform(chunk: Buffer, _enc, done) {
        got += chunk.length;
        if (total) set({ progress: Math.floor((got / total) * 100) });
        done(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), count, createWriteStream(file));
  };
  const download = async () => {
    if (!release || state.progress !== null || state.ready) return;
    const zip = zipUrl(release);
    set({ progress: 0, error: null, downloaded: null });
    try {
      if (zip) {
        next = await stageZip((file) => fetchTo(zip, file), release.version, release.sha256);
        set({ progress: null, ready: true });
        return;
      }
      if (!release.dmgUrl) throw new Error("The release has no .dmg.");
      const file = path.join(downloads ?? app.getPath("downloads"), `contr-mac-universal-${release.version}.dmg`);
      await fetchTo(release.dmgUrl, file);
      if (!e2e) {
        const failed = await shell.openPath(file);
        if (failed) throw new Error(failed);
      }
      set({ progress: null, downloaded: file });
    } catch (e) {
      set({ progress: null, error: `Download failed: ${(e as Error).message}` });
    }
  };
  /** Starts the detached swap script and quits; the script opens the new app (or the old one on failure). */
  const restart = async () => {
    if (!state.ready || !next || !target || e2e || restarting) return;
    restarting = true;
    try {
      await startSwap(process.pid, target, next);
    } catch (e) {
      restarting = false;
      clearStage();
      set({ ready: false, error: `Update failed: ${(e as Error).message}` });
      return;
    }
    app.quit();
  };
  ipcMain.handle(UPDATE_CHANNEL, () => ({ ...state }));
  ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, () => download());
  ipcMain.handle(UPDATE_RESTART_CHANNEL, () => restart());
  ipcMain.handle(UPDATE_CHECK_CHANNEL, () => check());
  ipcMain.handle(CHANGELOG_CHANNEL, (_e, again: boolean) => log.get(again === true));
  void check();
  if (url) setInterval(() => void check(), CHECK_MS);
  return { check };
}
