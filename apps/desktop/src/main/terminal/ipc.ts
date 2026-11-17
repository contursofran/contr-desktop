// The Terminal side's IPC. It shows the chat's terminal (the selected agent, see ../helper),
// in the hc session that CONTR_HC_SESSION names (empty: hc's default session), with the hc program that CONTR_HC names (else `hc`).
import { ipcMain, type WebContents } from "electron";
import { chatTerminal } from "../helper";
import { HcAttach } from "./hc-attach";

const sessions = new Map<number, HcAttach>();

export function registerTerminalIpc(): void {
  ipcMain.handle("terminal:attach", (e, cols: number, rows: number) => {
    const terminal = chatTerminal();
    const wc: WebContents = e.sender;
    const old = sessions.get(wc.id);
    old?.close();
    const a = new HcAttach({ terminal, session: process.env.CONTR_HC_SESSION, hc: process.env.CONTR_HC }, cols, rows, {
      data: (bytes) => { if (!wc.isDestroyed()) wc.send("terminal:data", bytes); },
      end: (reason) => { if (!wc.isDestroyed()) wc.send("terminal:end", reason); },
    });
    // One `destroyed` listener per renderer: it closes the attach of that time.
    if (!old) wc.once("destroyed", () => { sessions.get(wc.id)?.close(); sessions.delete(wc.id); });
    sessions.set(wc.id, a);
    return { terminal };
  });
  ipcMain.on("terminal:input", (e, text: string) => sessions.get(e.sender.id)?.input(text));
  ipcMain.on("terminal:resize", (e, cols: number, rows: number) => sessions.get(e.sender.id)?.resize(cols, rows));
}
