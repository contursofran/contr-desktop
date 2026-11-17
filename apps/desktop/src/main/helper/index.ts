import { app, BrowserWindow, dialog, ipcMain, type WebContents } from "electron";
import { ANSWER_CHANNEL, APPROVE_CHANNEL, FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, PICK_IMAGE_CHANNEL, REPLY_INFO_CHANNEL, SEND_CHANNEL, TAB_TITLE_CHANNEL } from "../../shared/api";
import path from "node:path";
import { pasteImage, sendText, startFeed } from "./feed";
import { answer, approve, type Answer } from "./card";
import { tabTitle } from "./title";
import { helperPath, runHelper } from "./run";
import { cachedCommands, replyInfo } from "./reply";
import { pickImage } from "./pick";

let selected: string | undefined;
/** The running feed of each renderer. */
const feeds = new Map<WebContents, () => void>();

/** The terminal of the chat's agent: the one picked in the sidebar, else CONTR_TERMINAL at start, else none (""): the renderer then picks one. */
export function chatTerminal(env = process.env): string {
  return selected ?? env.CONTR_TERMINAL ?? "";
}

/** Picks the chat's agent. The renderer then listens again, and the feed starts for this terminal. "" shows no agent: each feed stops. */
export function selectTerminal(terminal: string): void {
  selected = terminal;
  if (terminal !== "") return;
  for (const stop of feeds.values()) stop();
  feeds.clear();
}

/** Wires the helper to the renderer: the feed starts when the renderer listens. */
export function setupHelper(appRoot: string): void {
  const helper = helperPath(appRoot);
  // One `destroyed` listener per renderer, not one per chat mount.
  const watched = new WeakSet<WebContents>();
  ipcMain.on(FEED_READY_CHANNEL, (event) => {
    const sender = event.sender;
    feeds.get(sender)?.();
    feeds.delete(sender);
    if (!watched.has(sender)) {
      watched.add(sender);
      sender.once("destroyed", () => {
        feeds.get(sender)?.();
        feeds.delete(sender);
      });
    }
    // No agent shown: no feed.
    const terminal = chatTerminal();
    if (terminal === "") return;
    feeds.set(sender, startFeed(helper, terminal, (feed) => {
      if (!sender.isDestroyed()) sender.send(FEED_CHANNEL, feed);
    }));
  });
  ipcMain.handle(SEND_CHANNEL, (_event, text: string) => sendText(helper, chatTerminal(), text));
  ipcMain.handle(APPROVE_CHANNEL, (_event, request: string, allow: boolean) => approve(helper, chatTerminal(), request, allow));
  ipcMain.handle(ANSWER_CHANNEL, (_event, request: string, answers: Answer[]) => answer(helper, chatTerminal(), request, answers));
  ipcMain.handle(TAB_TITLE_CHANNEL, (_event, terminal: string) => tabTitle(terminal));
  // `commands` changes seldom: one good answer per agent and app run.
  const commands = cachedCommands((terminal) => runHelper(helper, ["commands", "--terminal", terminal]));
  ipcMain.handle(REPLY_INFO_CHANNEL, () => {
    const terminal = chatTerminal();
    return replyInfo(helper, terminal, commands(terminal));
  });
  ipcMain.handle(PICK_IMAGE_CHANNEL, (event) =>
    pickImage(process.env, (options) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options);
    }),
  );
  ipcMain.handle(PASTE_IMAGE_CHANNEL, () => pasteImage(helper, path.join(app.getPath("userData"), "paste")));
}
