// The Terminal side's IPC. The terminal to show comes from env vars for now:
// CONTR_HC_TERMINAL (address or name) and CONTR_HC_SESSION (the hc session; empty: hc's default).
import { ipcMain, type WebContents } from "electron";
import { HcAttach } from "./hc-attach";

const sessions = new Map<number, HcAttach>();

export function registerTerminalIpc(): void {
  ipcMain.handle("terminal:attach", (e, cols: number, rows: number) => {
    const terminal = process.env.CONTR_HC_TERMINAL;
    if (!terminal) return { error: "Set CONTR_HC_TERMINAL to the hc terminal to show." };
    const wc: WebContents = e.sender;
    sessions.get(wc.id)?.close();
    const a = new HcAttach({ terminal, session: process.env.CONTR_HC_SESSION }, cols, rows, {
      data: (bytes) => { if (!wc.isDestroyed()) wc.send("terminal:data", bytes); },
      end: (reason) => { if (!wc.isDestroyed()) wc.send("terminal:end", reason); },
    });
    sessions.set(wc.id, a);
    wc.once("destroyed", () => { a.close(); sessions.delete(wc.id); });
    return { terminal };
  });
  ipcMain.on("terminal:input", (e, text: string) => sessions.get(e.sender.id)?.input(text));
  ipcMain.on("terminal:resize", (e, cols: number, rows: number) => sessions.get(e.sender.id)?.resize(cols, rows));
}
