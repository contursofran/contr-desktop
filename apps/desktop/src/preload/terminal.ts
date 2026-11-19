import { ipcRenderer } from "electron";
import type { TerminalApi } from "../shared/api";

// The Terminal side's bridge: attach, keys and paste, size, and the bytes back.
export const terminalApi: TerminalApi = {
  start: (kind, cwd) => ipcRenderer.invoke("terminal:start", kind, cwd),
  attach: (cols, rows) => ipcRenderer.invoke("terminal:attach", cols, rows),
  input: (text) => ipcRenderer.send("terminal:input", text),
  resize: (cols, rows) => ipcRenderer.send("terminal:resize", cols, rows),
  onData(listener) {
    const handler = (_e: unknown, bytes: Uint8Array) => listener(bytes);
    ipcRenderer.on("terminal:data", handler);
    return () => ipcRenderer.off("terminal:data", handler);
  },
  onEnd(listener) {
    const handler = (_e: unknown, reason: string) => listener(reason);
    ipcRenderer.on("terminal:end", handler);
    return () => ipcRenderer.off("terminal:end", handler);
  },
};
