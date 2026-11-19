import { contextBridge, ipcRenderer } from "electron";
import { ANSWER_CHANNEL, APPROVE_CHANNEL, BOARD_CHANNEL, DIGEST_CHANNEL, FEED_CHANNEL, OPEN_REF_CHANNEL, REFS_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, PICK_IMAGE_CHANNEL, SEND_CHANNEL, TAB_TITLE_CHANNEL, REPLY_INFO_CHANNEL, SET_TIER_CHANNEL, BRANCH_CHANNEL, SIDEBAR_CHANNEL, SIDEBAR_EVENT, SELECT_CHANNEL, USAGE_CHANNEL, USAGE_EVENT, MACHINES_CHANNEL, OWNER_CHANNEL, OWNER_EVENT, OWNER_ANSWER_CHANNEL, OWNER_DONE_CHANNEL, OWNER_ERROR_CHANNEL, OWNER_ERROR_EVENT, SETTINGS_CHANNEL, THEME_CHANNEL, UPDATE_CHANNEL, UPDATE_EVENT, UPDATE_DOWNLOAD_CHANNEL, UPDATE_RESTART_CHANNEL, UPDATE_CHECK_CHANNEL, CHANGELOG_CHANNEL, OPEN_SETTINGS_EVENT, CORE_CHANNEL, CORE_EVENT, CORE_CHECK_CHANNEL, type CoreState, type UpdateState, type OwnerItems, type Sidebar, type UsageRow, type ContrApi, type FeedEvent } from "../shared/api";
import { terminalApi } from "./terminal";
import { PR_CARD_CHANNEL } from "../shared/api";
import { HEALTH_CHANNEL, HEALTH_CHECK_CHANNEL, HEALTH_EVENT, type HealthReport } from "../shared/api";

const api: ContrApi = {
  platform: process.platform,
  onFeed(listener) {
    const handler = (_event: unknown, feed: FeedEvent) => listener(feed);
    ipcRenderer.on(FEED_CHANNEL, handler);
    ipcRenderer.send(FEED_READY_CHANNEL);
    return () => ipcRenderer.off(FEED_CHANNEL, handler);
  },
  send: (text) => ipcRenderer.invoke(SEND_CHANNEL, text),
  tabTitle: (terminal) => ipcRenderer.invoke(TAB_TITLE_CHANNEL, terminal),
  pasteImage: () => ipcRenderer.invoke(PASTE_IMAGE_CHANNEL),
  pickImage: () => ipcRenderer.invoke(PICK_IMAGE_CHANNEL),
  refs: (numbers) => ipcRenderer.invoke(REFS_CHANNEL, numbers),
  openRef: (url) => ipcRenderer.invoke(OPEN_REF_CHANNEL, url),
  approve: (request, allow) => ipcRenderer.invoke(APPROVE_CHANNEL, request, allow),
  answer: (request, answers) => ipcRenderer.invoke(ANSWER_CHANNEL, request, answers),
  board: (issues) => ipcRenderer.invoke(BOARD_CHANNEL, issues),
  digest: () => ipcRenderer.invoke(DIGEST_CHANNEL),
  replyInfo: () => ipcRenderer.invoke(REPLY_INFO_CHANNEL),
  setTier: (terminal, tier) => ipcRenderer.invoke(SET_TIER_CHANNEL, terminal, tier),
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
  ownerError: () => ipcRenderer.invoke(OWNER_ERROR_CHANNEL),
  onOwnerError(listener) {
    const handler = (_event: unknown, error: string | null) => listener(error);
    ipcRenderer.on(OWNER_ERROR_EVENT, handler);
    return () => ipcRenderer.off(OWNER_ERROR_EVENT, handler);
  },
  settings: () => ipcRenderer.invoke(SETTINGS_CHANNEL),
  health: () => ipcRenderer.invoke(HEALTH_CHANNEL),
  checkHealth: () => ipcRenderer.invoke(HEALTH_CHECK_CHANNEL),
  onHealth(listener) {
    const handler = (_event: unknown, report: HealthReport) => listener(report);
    ipcRenderer.on(HEALTH_EVENT, handler);
    return () => ipcRenderer.off(HEALTH_EVENT, handler);
  },
  setTheme: (theme) => ipcRenderer.invoke(THEME_CHANNEL, theme),
  update: () => ipcRenderer.invoke(UPDATE_CHANNEL),
  onUpdate(listener) {
    const handler = (_event: unknown, state: UpdateState) => listener(state);
    ipcRenderer.on(UPDATE_EVENT, handler);
    return () => ipcRenderer.off(UPDATE_EVENT, handler);
  },
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
  restartToUpdate: () => ipcRenderer.invoke(UPDATE_RESTART_CHANNEL),
  checkUpdate: () => ipcRenderer.invoke(UPDATE_CHECK_CHANNEL),
  changeLog: (again) => ipcRenderer.invoke(CHANGELOG_CHANNEL, again === true),
  core: () => ipcRenderer.invoke(CORE_CHANNEL),
  onCore(listener) {
    const handler = (_event: unknown, state: CoreState) => listener(state);
    ipcRenderer.on(CORE_EVENT, handler);
    return () => ipcRenderer.off(CORE_EVENT, handler);
  },
  checkCore: (force) => ipcRenderer.invoke(CORE_CHECK_CHANNEL, force === true),
  onOpenSettings(listener) {
    const handler = () => listener();
    ipcRenderer.on(OPEN_SETTINGS_EVENT, handler);
    return () => ipcRenderer.off(OPEN_SETTINGS_EVENT, handler);
  },
  terminal: terminalApi,
  prCard: (n) => ipcRenderer.invoke(PR_CARD_CHANNEL, n),
};

contextBridge.exposeInMainWorld("contr", api);
