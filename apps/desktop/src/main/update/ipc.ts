import { app, BrowserWindow, ipcMain, shell } from "electron";
import { createWriteStream, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { UPDATE_CHANNEL, UPDATE_CHECK_CHANNEL, UPDATE_DOWNLOAD_CHANNEL, UPDATE_EVENT, UPDATE_RESTART_CHANNEL, type UpdateState } from "../../shared/api";
import { afterCheck, singleFlight } from "./check";
import { bundleOf, startSwap, unpack, writable } from "./install";
import { DMG, newer, parseRelease, RELEASE_URL, ZIP } from "./release";

/**
 * GitHub has no release event for an app: the newest release is read at start, every 6 hours, each time the
 * Settings view opens, on "Check now" and on the app menu's "Check for Updates…".
 */
const CHECK_MS = 6 * 60 * 60_000;

/**
 * The Update button (owner decision, docs/decisions/80-auto-install.md). Only a packaged app checks; dev and e2e
 * show "Development build", unless CONTR_UPDATE_URL points the check at a fake release (e2e).
 * When the app's folder is writable and the release has the .zip, a press downloads and checks the new app,
 * and "Restart to update" swaps it in. Else a press downloads the .dmg into Downloads and opens it.
 * CONTR_INSTALL_DIR replaces the folder of the running app, CONTR_DOWNLOADS the Downloads folder.
 * With CONTR_E2E=1 nothing is opened, swapped or quit.
 */
export function registerUpdateIpc(): { check: () => Promise<void> } {
  const url = process.env.CONTR_UPDATE_URL ?? (app.isPackaged ? RELEASE_URL : null);
  const e2e = process.env.CONTR_E2E === "1";
  const target = process.env.CONTR_INSTALL_DIR ? path.join(process.env.CONTR_INSTALL_DIR, "contr.app") : app.isPackaged ? bundleOf(app.getPath("exe")) : null;
  const state: UpdateState = { current: app.getVersion(), dev: url === null, latest: null, available: false, progress: null, downloaded: null, ready: false, error: null, checking: false, checked: null };
  let release: { version: string; dmgUrl: string | null; zipUrl: string | null } | null = null;
  let next: string | null = null;
  const set = (change: Partial<UpdateState>) => {
    Object.assign(state, change);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(UPDATE_EVENT, { ...state });
  };
  /** Installs from the .zip when the release has it and the app's folder is writable. */
  const zipUrl = (r = release) => (r?.zipUrl && target && writable(path.dirname(target)) ? r.zipUrl : null);
  /** One check at a time (singleFlight); see afterCheck for a check while a download runs or is ready. */
  const check = singleFlight(async () => {
    if (!url) return;
    set({ checking: true });
    try {
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const found = parseRelease(await res.json());
      const { take, change } = afterCheck(state, found.version, zipUrl(found) !== null || found.dmgUrl !== null, newer(found.version, state.current), Date.now());
      if (take) release = found;
      set(change);
    } catch (e) {
      set({ checking: false, checked: Date.now(), error: `Update check failed: ${(e as Error).message}` });
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
    const zip = zipUrl();
    set({ progress: 0, error: null, downloaded: null });
    try {
      if (zip) {
        const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-zip-")), ZIP);
        await fetchTo(zip, file);
        next = await unpack(file, release.version);
        set({ progress: null, ready: true });
        return;
      }
      if (!release.dmgUrl) throw new Error("The release has no .dmg.");
      const file = path.join(process.env.CONTR_DOWNLOADS ?? app.getPath("downloads"), DMG);
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
  const restart = () => {
    if (!state.ready || !next || !target || e2e) return;
    startSwap(process.pid, target, next);
    app.quit();
  };
  ipcMain.handle(UPDATE_CHANNEL, () => ({ ...state }));
  ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, () => download());
  ipcMain.handle(UPDATE_RESTART_CHANNEL, () => restart());
  ipcMain.handle(UPDATE_CHECK_CHANNEL, () => check());
  void check();
  if (url) setInterval(() => void check(), CHECK_MS);
  return { check };
}
