import { contextBridge, ipcRenderer } from "electron";
import { BOARD_CHANNEL, FEED_CHANNEL, OPEN_REF_CHANNEL, REFS_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL, REPLY_INFO_CHANNEL, BRANCH_CHANNEL, SIDEBAR_CHANNEL, SIDEBAR_EVENT, SELECT_CHANNEL, USAGE_CHANNEL, USAGE_EVENT, MACHINES_CHANNEL, type Sidebar, type UsageRow, type ContrApi, type FeedEvent } from "../shared/api";
import { terminalApi } from "./terminal";

const api: ContrApi = {
  platform: process.platform,
  onFeed(listener) {
    const handler = (_event: unknown, feed: FeedEvent) => listener(feed);
    ipcRenderer.on(FEED_CHANNEL, handler);
    ipcRenderer.send(FEED_READY_CHANNEL);
    return () => ipcRenderer.off(FEED_CHANNEL, handler);
  },
  send: (text) => ipcRenderer.invoke(SEND_CHANNEL, text),
  title: () => ipcRenderer.invoke(TITLE_CHANNEL),
  pasteImage: () => ipcRenderer.invoke(PASTE_IMAGE_CHANNEL),
  refs: (numbers) => ipcRenderer.invoke(REFS_CHANNEL, numbers),
  openRef: (url) => ipcRenderer.invoke(OPEN_REF_CHANNEL, url),
  board: (issues) => ipcRenderer.invoke(BOARD_CHANNEL, issues),
  replyInfo: () => ipcRenderer.invoke(REPLY_INFO_CHANNEL),
  branch: () => ipcRenderer.invoke(BRANCH_CHANNEL),
  sidebar: () => ipcRenderer.invoke(SIDEBAR_CHANNEL),
  onSidebar(listener) {
    const handler = (_event: unknown, sidebar: Sidebar) => listener(sidebar);
    ipcRenderer.on(SIDEBAR_EVENT, handler);
    return () => ipcRenderer.off(SIDEBAR_EVENT, handler);
  },
  select: (terminal) => ipcRenderer.invoke(SELECT_CHANNEL, terminal),
  usage: () => ipcRenderer.invoke(USAGE_CHANNEL),
  onUsage(listener) {
    const handler = (_event: unknown, rows: UsageRow[]) => listener(rows);
    ipcRenderer.on(USAGE_EVENT, handler);
    return () => ipcRenderer.off(USAGE_EVENT, handler);
  },
  machines: () => ipcRenderer.invoke(MACHINES_CHANNEL),
  terminal: terminalApi,
};

contextBridge.exposeInMainWorld("contr", api);
