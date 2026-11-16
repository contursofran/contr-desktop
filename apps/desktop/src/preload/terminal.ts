import { ipcRenderer } from "electron";

// The Terminal side's bridge: attach, keys and paste, size, and the bytes back.
export const terminalApi = {
  attach: (cols: number, rows: number): Promise<{ terminal?: string; error?: string }> =>
    ipcRenderer.invoke("terminal:attach", cols, rows),
  input: (text: string) => ipcRenderer.send("terminal:input", text),
  resize: (cols: number, rows: number) => ipcRenderer.send("terminal:resize", cols, rows),
  onData: (cb: (bytes: Uint8Array) => void) => ipcRenderer.on("terminal:data", (_e, b: Uint8Array) => cb(b)),
  onEnd: (cb: (reason: string) => void) => ipcRenderer.on("terminal:end", (_e, r: string) => cb(r)),
};
export type TerminalApi = typeof terminalApi;
