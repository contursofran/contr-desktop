import { contextBridge } from "electron";
import { terminalApi } from "./terminal";

// The bridge to the renderer. Later spike steps add the helper feed here.
contextBridge.exposeInMainWorld("contr", { platform: process.platform, terminal: terminalApi });
