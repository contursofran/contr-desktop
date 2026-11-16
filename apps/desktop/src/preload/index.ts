import { contextBridge } from "electron";

// The bridge to the renderer. Later spike steps add the helper feed here.
contextBridge.exposeInMainWorld("contr", { platform: process.platform });
