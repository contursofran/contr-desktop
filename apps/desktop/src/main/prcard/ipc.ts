import { ipcMain } from "electron";
import { PR_CARD_CHANNEL, type PrCard } from "../../shared/api";
import { orchPath } from "../board/board";
import { repoDir } from "../refs/ipc";
import { readPrCard } from "./prcard";

/** A card's read is kept 20 s: cards ask every 30 s, and cards of one PR share one read. */
const PR_CARD_TTL_MS = 20_000;

/** The `contr-pr` card of a PR of the chat's agent's repository, from gh and the orchestration tool. */
export function registerPrCardIpc(appRoot: string, terminal: () => string): void {
  const reads = new Map<string, { at: number; value: Promise<PrCard | null> }>();
  ipcMain.handle(PR_CARD_CHANNEL, (_event, n: unknown) => {
    if (!Number.isInteger(n) || (n as number) <= 0) return null;
    const t = terminal();
    const key = `${t}#${n}`;
    const last = reads.get(key);
    if (last && Date.now() - last.at < PR_CARD_TTL_MS) return last.value;
    const value = repoDir(t).then((cwd) => readPrCard({ n: n as number, gh: process.env.CONTR_GH ?? "gh", orch: orchPath(appRoot), cwd, terminal: t }));
    reads.set(key, { at: Date.now(), value });
    return value;
  });
}
