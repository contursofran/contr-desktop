import { contextBridge, ipcRenderer } from "electron";
import { BOARD_CHANNEL, FEED_CHANNEL, OPEN_REF_CHANNEL, REFS_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL, type ContrApi, type FeedEvent } from "../shared/api";
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
  terminal: terminalApi,
};

contextBridge.exposeInMainWorld("contr", api);
