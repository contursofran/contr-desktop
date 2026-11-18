import { ipcMain } from "electron";
import { DIGEST_CHANNEL, type Digest, type FeedEvent } from "../../shared/api";
import { orchPath } from "../board/board";
import { repoDir } from "../refs/ipc";
import { OwnerTimes, readDigest } from "./digest";

/** A digest is kept 20 s: digest blocks ask every 30 s, and blocks in one view share one read. */
const DIGEST_TTL_MS = 20_000;

const times = new Map<string, OwnerTimes>();

/** Keeps the times of the owner's messages from each feed splice of a terminal. */
export function noteFeed(terminal: string, event: FeedEvent): void {
  if (event.type !== "splice") return;
  if (!times.has(terminal)) times.set(terminal, new OwnerTimes());
  times.get(terminal)!.splice(event.at, event.rows);
}

/** The `contr-digest` counts for the chat's agent, from gh and the orchestration tool. */
export function registerDigestIpc(appRoot: string, terminal: () => string): void {
  let last: { at: number; terminal: string; since: number | null; value: Promise<Digest> } | undefined;
  ipcMain.handle(DIGEST_CHANNEL, async () => {
    const t = terminal();
    const since = times.get(t)?.leftAt() ?? null;
    if (!last || last.terminal !== t || last.since !== since || Date.now() - last.at >= DIGEST_TTL_MS) {
      const value = repoDir(t).then((cwd) => readDigest({ orch: orchPath(appRoot), gh: process.env.CONTR_GH ?? "gh", cwd, terminal: t, since }));
      last = { at: Date.now(), terminal: t, since, value };
    }
    return last.value;
  });
}
