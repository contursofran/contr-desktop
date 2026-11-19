import { app, BrowserWindow, dialog, ipcMain, type WebContents } from "electron";
import { ANSWER_CHANNEL, APPROVE_CHANNEL, FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, PICK_IMAGE_CHANNEL, REPLY_INFO_CHANNEL, SEND_CHANNEL, SET_TIER_CHANNEL, TAB_TITLE_CHANNEL, type FeedEvent, type SpeedTier } from "../../shared/api";
import path from "node:path";
import { pasteImage, sendText, startFeed } from "./feed";
import { answer, approve, type Answer } from "./card";
import { tabTitle } from "./title";
import { helperPath, runHelper } from "./run";
import { cachedCommands, replyInfo, setReplyTier } from "./reply";
import { pickImage } from "./pick";
import { codexThreadId } from "../../shared/codex";
import { codexSession } from "../codex/session";
import { noteFeed } from "../digest/ipc";

let selected: string | undefined;
/** The running feed of each renderer. */
const feeds = new Map<WebContents, () => void>();
/** Starts the feed of a renderer (set by setupHelper). */
let startFor: (sender: WebContents) => void = () => undefined;
/** Empties the `commands` cache (set by setupHelper). */
let clearCommands: () => void = () => undefined;

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

/** Stops and starts each feed (a new cursor, the helper path read again) and empties the `commands` cache. */
export function restartFeeds(): void {
  clearCommands();
  for (const [sender, stop] of [...feeds]) {
    stop();
    feeds.delete(sender);
    if (!sender.isDestroyed()) startFor(sender);
  }
}

/** Wires the helper to the renderer: the feed starts when the renderer listens. The helper path is read at each use. */
export function setupHelper(appRoot: string): void {
  const helper = () => helperPath(appRoot);
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
    startFor(sender);
  });
  startFor = (sender) => {
    // No agent shown: no feed.
    const terminal = chatTerminal();
    if (terminal === "") return;
    if (codexThreadId(terminal)) {
      let stopped = false;
      let unfollow: (() => void) | undefined;
      feeds.set(sender, () => { stopped = true; unfollow?.(); });
      const emit = (feed: FeedEvent) => {
        if (!stopped && !sender.isDestroyed()) sender.send(FEED_CHANNEL, feed);
      };
      void codexSession(terminal).then((session) => {
        if (!stopped) unfollow = session.follow(emit);
      }).catch((error: Error) => emit({ type: "error", code: "codex", message: error.message }));
      return;
    }
    feeds.set(sender, startFeed(helper(), terminal, (feed) => {
      noteFeed(terminal, feed);
      if (!sender.isDestroyed()) sender.send(FEED_CHANNEL, feed);
    }));
  };
  ipcMain.handle(SEND_CHANNEL, async (_event, text: string) => {
    const tab = chatTerminal();
    if (!codexThreadId(tab)) return sendText(helper(), tab, text);
    try { return (await codexSession(tab)).send(text); }
    catch (error) { return { ok: false, message: (error as Error).message }; }
  });
  ipcMain.handle(APPROVE_CHANNEL, async (_event, request: string, allow: boolean) => {
    const tab = chatTerminal();
    if (!codexThreadId(tab)) return approve(helper(), tab, request, allow);
    try { return (await codexSession(tab)).approve(request, allow); }
    catch (error) { return { result: "failed", message: (error as Error).message }; }
  });
  ipcMain.handle(ANSWER_CHANNEL, (_event, request: string, answers: Answer[]) => answer(helper(), chatTerminal(), request, answers));
  ipcMain.handle(TAB_TITLE_CHANNEL, (_event, terminal: string) => codexThreadId(terminal) ? { title: "Codex" } : tabTitle(terminal));
  // `commands` changes seldom: one good answer per agent and app run.
  const fresh = () => cachedCommands((terminal) => runHelper(helper(), ["commands", "--terminal", terminal]));
  let commands = fresh();
  let tierFailures = new Set<string>();
  clearCommands = () => {
    commands = fresh();
    tierFailures = new Set();
  };
  ipcMain.handle(REPLY_INFO_CHANNEL, async () => {
    const terminal = chatTerminal();
    if (codexThreadId(terminal)) {
      const session = await codexSession(terminal).catch(() => null);
      return { agent: "codex", model: session?.model ?? null, effort: null, tier: null, tiers: [], speed: null, context: null, models: [], efforts: [] };
    }
    const info = await replyInfo(helper(), terminal, commands(terminal));
    return tierFailures.has(terminal) ? { ...info, tiers: [] } : info;
  });
  ipcMain.handle(SET_TIER_CHANNEL, async (_event, terminal: string, tier: SpeedTier) => {
    if (!terminal || terminal !== chatTerminal()) return { ok: false, message: "The active chat changed" };
    const failures = tierFailures;
    const result = await setReplyTier(helper(), terminal, tier);
    if (!result.ok) failures.add(terminal);
    return result;
  });
  ipcMain.handle(PICK_IMAGE_CHANNEL, (event) =>
    pickImage(process.env, (options) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options);
    }),
  );
  ipcMain.handle(PASTE_IMAGE_CHANNEL, () => pasteImage(helper(), path.join(app.getPath("userData"), "paste")));
}
