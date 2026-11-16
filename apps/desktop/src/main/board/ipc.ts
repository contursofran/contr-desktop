import { ipcMain } from "electron";
import { BOARD_CHANNEL, type PrChecks } from "../../shared/api";
import { RefCache } from "../refs/gh";
import { repoDir } from "../refs/ipc";
import { ghChecks, orchBoard, orchPath } from "./board";

/** Worker states are kept 5 s: the board asks every 10 s, and blocks in one view share one tool run. */
const WORKERS_TTL_MS = 5_000;

/** Worker states (orchestration tool) and PR checks (gh, cached 60 s per issue) for the `contr-status` board. */
export function registerBoardIpc(appRoot: string, terminal: string): void {
  const orch = orchPath(appRoot);
  let workers: { at: number; value: ReturnType<typeof orchBoard> } | undefined;
  let dir: Promise<string | null> | undefined;
  const checks = new RefCache<PrChecks>(async (issues) => {
    dir ??= repoDir(terminal);
    const cwd = await dir;
    return cwd ? ghChecks(cwd, issues) : new Map();
  });
  ipcMain.handle(BOARD_CHANNEL, async (_event, issues: unknown) => {
    if (!workers || Date.now() - workers.at >= WORKERS_TTL_MS) workers = { at: Date.now(), value: orchBoard(orch, terminal) };
    const wanted = Array.isArray(issues) ? issues.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
    const [w, c] = await Promise.all([workers.value, checks.get(wanted)]);
    return { ...w, checks: c };
  });
}
