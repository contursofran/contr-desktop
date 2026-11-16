import { ipcMain } from "electron";
import { BOARD_CHANNEL, type PrChecks } from "../../shared/api";
import { RefCache } from "../refs/gh";
import { repoDir } from "../refs/ipc";
import { ghChecks, orchBoard, orchPath } from "./board";

/** Worker states are kept 5 s: the board asks every 10 s, and blocks in one view share one tool run. */
const WORKERS_TTL_MS = 5_000;

/** Worker states (orchestration tool) and PR checks (gh, cached 60 s per issue) for the `contr-status` board. */
export function registerBoardIpc(appRoot: string, terminal: () => string): void {
  const orch = orchPath(appRoot);
  const hc = process.env.CONTR_HC ?? "hc";
  let workers: { at: number; terminal: string; value: ReturnType<typeof orchBoard> } | undefined;
  // One cache per agent: agents can be in other repositories.
  const caches = new Map<string, RefCache<PrChecks>>();
  const checksOf = (t: string) => {
    if (!caches.has(t)) {
      let dir: Promise<string | null> | undefined;
      caches.set(t, new RefCache<PrChecks>(async (issues) => {
        dir ??= repoDir(t);
        const cwd = await dir;
        return cwd ? ghChecks(cwd, issues) : new Map();
      }));
    }
    return caches.get(t)!;
  };
  ipcMain.handle(BOARD_CHANNEL, async (_event, issues: unknown) => {
    const t = terminal();
    if (!workers || workers.terminal !== t || Date.now() - workers.at >= WORKERS_TTL_MS)
      workers = { at: Date.now(), terminal: t, value: orchBoard(orch, hc, t) };
    const wanted = Array.isArray(issues) ? issues.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
    const [w, c] = await Promise.all([workers.value, checksOf(t).get(wanted)]);
    return { ...w, checks: c };
  });
}
