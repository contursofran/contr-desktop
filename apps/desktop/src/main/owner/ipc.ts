import { execFile } from "node:child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import { OWNER_ANSWER_CHANNEL, OWNER_CHANNEL, OWNER_DONE_CHANNEL, OWNER_EVENT, type OwnerItems } from "../../shared/api";
import { orchPath } from "../board/board";
import { run } from "../sidebar/agents";
import { inboxCount, ownerResult, parseOwnerOpen, windowTitle } from "./owner";

/** The open count as the main process last set it; e2e reads it here, as e2e runs set no Dock badge. */
export let inboxBadge = 0;

/** Shows `n` in each window title and on the Dock badge (not under CONTR_E2E: no Dock icon there). */
export function showInboxCount(n: number): void {
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
  const orch = orchPath(appRoot);
  let last: OwnerItems = { questions: [], todos: [] };
  let lastText = JSON.stringify(last);
  const read = async () => {
    const items = parseOwnerOpen(await run(orch, ["owner", "open", "--json"]));
    const text = JSON.stringify(items);
    if (text === lastText) return;
    last = items;
    lastText = text;
    showInboxCount(inboxCount(last));
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(OWNER_EVENT, last);
  };
  showInboxCount(0);
  void read();
  setInterval(() => void read(), OWNER_POLL_MS);
  ipcMain.handle(OWNER_CHANNEL, () => last);
  ipcMain.handle(OWNER_ANSWER_CHANNEL, async (_e, id: unknown, answer: unknown) => {
    const r = await runOrch(orch, ["owner", "answer", String(id), String(answer)]);
    await read();
    return ownerResult(r.code, r.stderr, "The answer is saved");
  });
  ipcMain.handle(OWNER_DONE_CHANNEL, async (_e, id: unknown) => {
    const r = await runOrch(orch, ["owner", "done", String(id)]);
    await read();
    return ownerResult(r.code, r.stderr, "The to-do is marked done");
  });
}
