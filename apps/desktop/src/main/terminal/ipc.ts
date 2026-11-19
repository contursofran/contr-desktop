// The Terminal side's IPC. It shows the chat's terminal (the selected agent, see ../helper),
// in the hc session that CONTR_HC_SESSION names (empty: hc's default session), with the hc program that CONTR_HC names (else `hc`).
import { ipcMain, type WebContents } from "electron";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import type { TerminalStart } from "../../shared/api";
import { chatTerminal } from "../helper";
import { runRead } from "../sidebar/agents";
import { HcAttach } from "./hc-attach";

const sessions = new Map<number, HcAttach>();

export function registerTerminalIpc(): void {
  ipcMain.handle("terminal:start", (_event, kind: unknown, cwd: unknown) => startTerminal(kind, cwd));
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

/** Starts only one of the three programs in the New tab menu. */
async function startTerminal(kind: unknown, cwd: unknown): Promise<TerminalStart> {
  if (kind !== "claude" && kind !== "codex" && kind !== "shell") return { error: "Unknown terminal program" };
  if (cwd !== null && (typeof cwd !== "string" || !isAbsolute(cwd))) return { error: "The terminal needs an absolute folder path" };
  const args = ["run", "--bg", "--json", "--no-parent", "--cwd", cwd ?? homedir()];
  if (kind !== "shell") args.push("--", kind);
  const { out, error } = await runRead(process.env.CONTR_HC ?? "hc", args);
  if (error) return { error };
  try {
    const result = JSON.parse(out) as { address?: unknown } | null;
    if (typeof result?.address === "string" && result.address) return { terminal: result.address };
  } catch {
    return { error: "hc gave no JSON" };
  }
  return { error: "hc gave no terminal address" };
}
