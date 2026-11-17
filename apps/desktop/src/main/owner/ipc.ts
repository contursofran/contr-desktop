import { execFile } from "node:child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import { OWNER_ANSWER_CHANNEL, OWNER_CHANNEL, OWNER_DONE_CHANNEL, OWNER_ERROR_CHANNEL, OWNER_ERROR_EVENT, OWNER_EVENT, type OwnerItems } from "../../shared/api";
import { orchPath } from "../board/board";
import { runRead } from "../sidebar/agents";
import { inboxCount, ownerAnswerArgs, ownerResult, readOwnerOpen, windowTitle } from "./owner";

/** The open count as the main process last set it; e2e reads it here, as e2e runs set no Dock badge. */
export let inboxBadge = 0;

/** The open owner items and the agents blocked on a prompt; the Inbox count is their sum. */
let ownerOpen = 0;
let blocked = 0;

/** Sets the number of agents blocked on a prompt (the sidebar's hc read) and shows the new count. */
export function setBlockedCount(n: number): void {
  blocked = n;
  showInboxCount();
}

/** Shows the Inbox count in each window title and on the Dock badge (not under CONTR_E2E: no Dock icon there). */
function showInboxCount(): void {
  const n = ownerOpen + blocked;
  inboxBadge = n;
  (globalThis as { contrInboxBadge?: number }).contrInboxBadge = n;
  for (const w of BrowserWindow.getAllWindows()) w.setTitle(windowTitle(n));
  if (process.env.CONTR_E2E !== "1") app.setBadgeCount(n);
}

/** The owner file has no event: `owner open --json` is read every 3 s (docs/design/recipe-herdr.md). */
const OWNER_POLL_MS = 3_000;

function runOrch(orch: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    execFile(orch, args, { timeout: 30_000 }, (e, _stdout, stderr) => {
      const code = e ? (typeof e.code === "number" ? e.code : null) : 0;
      resolve({ code, stderr: String(stderr ?? "") || (e && code == null ? e.message : "") });
    });
  });
}

/** The owner's open questions and to-dos, and the runs that answer them or mark them done. */
export function registerOwnerIpc(appRoot: string): void {
  let last: OwnerItems = { questions: [], todos: [] };
  let lastText = JSON.stringify(last);
  let error: string | null = null;
  const read = async () => {
    const r = await runRead(orchPath(appRoot), ["owner", "open", "--json"]);
    const { items, error: why } = readOwnerOpen(last, r.out, r.error);
    if (why !== error) {
      error = why;
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send(OWNER_ERROR_EVENT, error);
    }
    const text = JSON.stringify(items);
    if (text === lastText) return;
    last = items;
    lastText = text;
    ownerOpen = inboxCount(last);
    showInboxCount();
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(OWNER_EVENT, last);
  };
  showInboxCount();
  void read();
  setInterval(() => void read(), OWNER_POLL_MS);
  ipcMain.handle(OWNER_CHANNEL, () => last);
  ipcMain.handle(OWNER_ERROR_CHANNEL, () => error);
  ipcMain.handle(OWNER_ANSWER_CHANNEL, async (_e, id: unknown, answer: unknown) => {
    const r = await runOrch(orchPath(appRoot), ownerAnswerArgs(String(id), String(answer)));
    await read();
    return ownerResult(r.code, r.stderr, "The answer is saved");
  });
  ipcMain.handle(OWNER_DONE_CHANNEL, async (_e, id: unknown) => {
    const r = await runOrch(orchPath(appRoot), ["owner", "done", String(id)]);
    await read();
    return ownerResult(r.code, r.stderr, "The to-do is marked done");
  });
}
