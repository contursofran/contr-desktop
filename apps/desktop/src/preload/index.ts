import { contextBridge, ipcRenderer } from "electron";
import { FEED_CHANNEL, FEED_READY_CHANNEL, PASTE_IMAGE_CHANNEL, SEND_CHANNEL, TITLE_CHANNEL, type ContrApi, type FeedEvent } from "../shared/api";

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
};

contextBridge.exposeInMainWorld("contr", api);
