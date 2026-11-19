import { appChildren } from "../children";
import { spawn } from "node:child_process";
import { BrowserWindow, ipcMain } from "electron";
import { SELECT_CHANNEL, SIDEBAR_CHANNEL, SIDEBAR_EVENT, type Sidebar } from "../../shared/api";
import { orchPath } from "../board/board";
import { chatTerminal, selectTerminal } from "../helper";
import { setBlockedCount } from "../owner/ipc";
import { blockedAgents } from "../../shared/inbox";
import { codexAgents, onCodexSidebarChange, restoreCodexTabs } from "../codex/session";
import { sidebarReader } from "./reader";
import { lineSplitter, readScheduler } from "./schedule";

/** Without hc events (hc gone or too old), the list is read again every 10 s. While `hc events` runs, there is no poll for hc. */
const POLL_MS = 10_000;
/** hc events come in bursts: one read for a burst, 500 ms after its last line... */
const DEBOUNCE_MS = 500;
/** ...but no later than 2 s after its first line, so a steady stream still updates the list. */
const MAX_WAIT_MS = 2_000;
/** git has no event for a commit or a fetch: the branch and the commits ahead and behind of the shown projects are read again every 30 s. */
const GIT_POLL_MS = 30_000;

/** The Projects list: agents from `hc ls --json`, each under the project of its session folder (`hc get --json`), workers' names from the orchestration tool, read again on each `hc events` burst (`reader.ts`). */
export function registerSidebarIpc(appRoot: string): void {
  const hc = process.env.CONTR_HC ?? "hc";
  const reader = sidebarReader({ hc, git: process.env.CONTR_GIT ?? "git", orch: () => orchPath(appRoot) });
  let last: Sidebar = { projects: [], selected: chatTerminal() };

  const refresh = readScheduler(
    () =>
      reader.read(codexAgents()).then((s) => {
        last = { ...s, selected: chatTerminal() };
        setBlockedCount(blockedAgents(s.projects).length);
        for (const w of BrowserWindow.getAllWindows()) w.webContents.send(SIDEBAR_EVENT, last);
      }),
    DEBOUNCE_MS,
    MAX_WAIT_MS,
  );
  const follow = () => {
    const events = appChildren.track(spawn(hc, ["events", "--json"], { stdio: ["ignore", "pipe", "ignore"] }));
    const lines = lineSplitter((line) => reader.event(line));
    events.stdout.on("data", (d: Buffer) => {
      lines(d);
      refresh();
    });
    events.on("error", () => undefined);
    events.on("close", () => setInterval(refresh, POLL_MS));
  };
  onCodexSidebarChange(refresh);
  follow();
  refresh();
  setInterval(() => {
    reader.gitDue();
    refresh();
  }, GIT_POLL_MS);

  // A read while hc failed (Retry) reads the list again at once; the new list comes as an event.
  ipcMain.handle(SIDEBAR_CHANNEL, (_event, openTabs: unknown) => {
    if (Array.isArray(openTabs)) restoreCodexTabs(openTabs.filter((tab): tab is string => typeof tab === "string"));
    if (last.hcError) refresh();
    return { ...last, selected: chatTerminal() };
  });
  ipcMain.handle(SELECT_CHANNEL, (_event, terminal: unknown) => {
    // "" shows no agent (each tab closed): main stops the feed.
    if (typeof terminal === "string") selectTerminal(terminal);
    return chatTerminal();
  });
}
