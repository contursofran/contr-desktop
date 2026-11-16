import { app, ipcMain, type WebContents } from "electron";
import { FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, REPLY_INFO_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL } from "../../shared/api";
import path from "node:path";
import { pasteImage, sendText, startFeed } from "./feed";
import { terminalTitle } from "./title";
import { helperPath, runHelper, type HelperLine } from "./run";
import { replyInfo } from "./reply";

let selected: string | undefined;

/** The terminal of the chat's agent: the one picked in the sidebar, else CONTR_TERMINAL at start. */
export function chatTerminal(env = process.env): string {
  return selected ?? env.CONTR_TERMINAL ?? "t1";
}

/** Picks the chat's agent. The renderer then listens again, and the feed starts for this terminal. */
export function selectTerminal(terminal: string): void {
  selected = terminal;
}

/** Wires the helper to the renderer: the feed starts when the renderer listens. */
export function setupHelper(appRoot: string): void {
  const helper = helperPath(appRoot);
  const feeds = new Map<WebContents, () => void>();
  ipcMain.on(FEED_READY_CHANNEL, (event) => {
    const sender = event.sender;
    feeds.get(sender)?.();
    feeds.set(sender, startFeed(helper, chatTerminal(), (feed) => {
      if (!sender.isDestroyed()) sender.send(FEED_CHANNEL, feed);
    }));
    sender.once("destroyed", () => {
      feeds.get(sender)?.();
      feeds.delete(sender);
    });
  });
  ipcMain.handle(SEND_CHANNEL, (_event, text: string) => sendText(helper, chatTerminal(), text));
  ipcMain.handle(TITLE_CHANNEL, () => terminalTitle(chatTerminal()));
  // `commands` changes seldom: one call per agent and app run.
  const commands = new Map<string, Promise<HelperLine[]>>();
  ipcMain.handle(REPLY_INFO_CHANNEL, () => {
    const terminal = chatTerminal();
    if (!commands.has(terminal)) commands.set(terminal, runHelper(helper, ["commands", "--terminal", terminal]));
    return replyInfo(helper, terminal, commands.get(terminal)!);
  });
  ipcMain.handle(PASTE_IMAGE_CHANNEL, () => pasteImage(helper, path.join(app.getPath("userData"), "paste")));
}
