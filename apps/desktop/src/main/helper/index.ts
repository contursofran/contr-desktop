import { app, ipcMain, type WebContents } from "electron";
import { FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, SEND_CHANNEL } from "../../shared/api";
import path from "node:path";
import { pasteImage, sendText, startFeed } from "./feed";
import { helperPath } from "./run";

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
  ipcMain.handle(PASTE_IMAGE_CHANNEL, () => pasteImage(helper, path.join(app.getPath("userData"), "paste")));
}
