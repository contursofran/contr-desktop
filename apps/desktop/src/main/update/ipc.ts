import { app, BrowserWindow, ipcMain, shell } from "electron";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { UPDATE_CHANNEL, UPDATE_DOWNLOAD_CHANNEL, UPDATE_EVENT, type UpdateState } from "../../shared/api";
import { DMG, newer, parseRelease, RELEASE_URL } from "./release";

/** GitHub has no release event for an app: the newest release is read at start and every 6 hours. */
const CHECK_MS = 6 * 60 * 60_000;

/**
 * The Update button (owner decision D97: no auto-install). Only a packaged app checks; dev and e2e show
 * "Development build", unless CONTR_UPDATE_URL points the check at a fake release (e2e).
 * CONTR_DOWNLOADS replaces the Downloads folder. e2e runs do not open the .dmg.
 */
export function registerUpdateIpc(): void {
  const url = process.env.CONTR_UPDATE_URL ?? (app.isPackaged ? RELEASE_URL : null);
  const state: UpdateState = { current: app.getVersion(), dev: url === null, latest: null, available: false, progress: null, downloaded: null, error: null };
  let dmgUrl: string | null = null;
  const set = (change: Partial<UpdateState>) => {
    Object.assign(state, change);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(UPDATE_EVENT, { ...state });
  };
  const check = async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const release = parseRelease(await res.json());
      dmgUrl = release.dmgUrl;
      set({ latest: release.version, available: dmgUrl !== null && newer(release.version, state.current), error: null });
    } catch (e) {
      set({ error: `Update check failed: ${(e as Error).message}` });
    }
  };
  const download = async () => {
    if (!dmgUrl || state.progress !== null) return;
    const file = path.join(process.env.CONTR_DOWNLOADS ?? app.getPath("downloads"), DMG);
    set({ progress: 0, error: null, downloaded: null });
    try {
      const res = await fetch(dmgUrl);
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
      if (process.env.CONTR_E2E !== "1") {
        const failed = await shell.openPath(file);
        if (failed) throw new Error(failed);
      }
      set({ progress: null, downloaded: file });
    } catch (e) {
      set({ progress: null, error: `Download failed: ${(e as Error).message}` });
    }
  };
  ipcMain.handle(UPDATE_CHANNEL, () => ({ ...state }));
  ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, () => download());
  void check();
  if (url) setInterval(() => void check(), CHECK_MS);
}
