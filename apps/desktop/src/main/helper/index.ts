import { app, ipcMain, type WebContents } from "electron";
import { ANSWER_CHANNEL, APPROVE_CHANNEL, FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, REPLY_INFO_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL } from "../../shared/api";
import path from "node:path";
import { pasteImage, sendText, startFeed } from "./feed";
import { answer, approve, type Answer } from "./card";
import { terminalTitle } from "./title";
import { helperPath, runHelper, type HelperLine } from "./run";
import { replyInfo } from "./reply";

/** The terminal of the chat's agent. The spike shows one chat: CONTR_TERMINAL picks it. */
export function chatTerminal(env = process.env): string {
  return env.CONTR_TERMINAL ?? "t1";
}

/** Wires the helper to the renderer: the feed starts when the renderer listens. */
export function setupHelper(appRoot: string): void {
  const helper = helperPath(appRoot);
  const terminal = chatTerminal();
  const feeds = new Map<WebContents, () => void>();
  ipcMain.on(FEED_READY_CHANNEL, (event) => {
    const sender = event.sender;
    feeds.get(sender)?.();
    feeds.set(sender, startFeed(helper, terminal, (feed) => {
      if (!sender.isDestroyed()) sender.send(FEED_CHANNEL, feed);
    }));
    sender.once("destroyed", () => {
      feeds.get(sender)?.();
      feeds.delete(sender);
    });
  });
  ipcMain.handle(SEND_CHANNEL, (_event, text: string) => sendText(helper, terminal, text));
  ipcMain.handle(APPROVE_CHANNEL, (_event, request: string, allow: boolean) => approve(helper, terminal, request, allow));
  ipcMain.handle(ANSWER_CHANNEL, (_event, request: string, answers: Answer[]) => answer(helper, terminal, request, answers));
  ipcMain.handle(TITLE_CHANNEL, () => terminalTitle(terminal));
  // `commands` changes seldom: one call per app run.
  let commands: Promise<HelperLine[]> | undefined;
  ipcMain.handle(REPLY_INFO_CHANNEL, () => {
    commands ??= runHelper(helper, ["commands", "--terminal", terminal]);
    return replyInfo(helper, terminal, commands);
  });
  ipcMain.handle(PASTE_IMAGE_CHANNEL, () => pasteImage(helper, path.join(app.getPath("userData"), "paste")));
}
