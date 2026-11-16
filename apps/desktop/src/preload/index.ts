import { contextBridge, ipcRenderer } from "electron";
import { ANSWER_CHANNEL, APPROVE_CHANNEL, BOARD_CHANNEL, FEED_CHANNEL, OPEN_REF_CHANNEL, REFS_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, PICK_IMAGE_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL, TAB_TITLE_CHANNEL, REPLY_INFO_CHANNEL, BRANCH_CHANNEL, SIDEBAR_CHANNEL, SIDEBAR_EVENT, SELECT_CHANNEL, USAGE_CHANNEL, USAGE_EVENT, MACHINES_CHANNEL, OWNER_CHANNEL, OWNER_EVENT, OWNER_ANSWER_CHANNEL, OWNER_DONE_CHANNEL, SETTINGS_CHANNEL, THEME_CHANNEL, UPDATE_CHANNEL, UPDATE_EVENT, UPDATE_DOWNLOAD_CHANNEL, UPDATE_RESTART_CHANNEL, type UpdateState, type OwnerItems, type Sidebar, type UsageRow, type ContrApi, type FeedEvent } from "../shared/api";
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
  tabTitle: (terminal) => ipcRenderer.invoke(TAB_TITLE_CHANNEL, terminal),
  pasteImage: () => ipcRenderer.invoke(PASTE_IMAGE_CHANNEL),
  pickImage: () => ipcRenderer.invoke(PICK_IMAGE_CHANNEL),
  refs: (numbers) => ipcRenderer.invoke(REFS_CHANNEL, numbers),
  openRef: (url) => ipcRenderer.invoke(OPEN_REF_CHANNEL, url),
  approve: (request, allow) => ipcRenderer.invoke(APPROVE_CHANNEL, request, allow),
  answer: (request, answers) => ipcRenderer.invoke(ANSWER_CHANNEL, request, answers),
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
  owner: () => ipcRenderer.invoke(OWNER_CHANNEL),
  onOwner(listener) {
    const handler = (_event: unknown, items: OwnerItems) => listener(items);
    ipcRenderer.on(OWNER_EVENT, handler);
    return () => ipcRenderer.off(OWNER_EVENT, handler);
  },
  ownerAnswer: (id, answer) => ipcRenderer.invoke(OWNER_ANSWER_CHANNEL, id, answer),
  ownerDone: (id) => ipcRenderer.invoke(OWNER_DONE_CHANNEL, id),
  settings: () => ipcRenderer.invoke(SETTINGS_CHANNEL),
  setTheme: (theme) => ipcRenderer.invoke(THEME_CHANNEL, theme),
  update: () => ipcRenderer.invoke(UPDATE_CHANNEL),
  onUpdate(listener) {
    const handler = (_event: unknown, state: UpdateState) => listener(state);
    ipcRenderer.on(UPDATE_EVENT, handler);
    return () => ipcRenderer.off(UPDATE_EVENT, handler);
  },
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
  restartToUpdate: () => ipcRenderer.invoke(UPDATE_RESTART_CHANNEL),
  terminal: terminalApi,
};

contextBridge.exposeInMainWorld("contr", api);
