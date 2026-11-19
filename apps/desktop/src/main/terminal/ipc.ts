// The Terminal side's IPC. It shows the chat's terminal (the selected agent, see ../helper),
// in the hc session that CONTR_HC_SESSION names (empty: hc's default session), with the hc program that CONTR_HC names (else `hc`).
import { ipcMain, nativeTheme, type WebContents } from "electron";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import type { TerminalClose, TerminalStart } from "../../shared/api";
import { terminalDisplay } from "../../shared/terminal-display";
import { HcRequestError, hcCommand, runHcTerminal } from "./hc-command";
import { chatTerminal } from "../helper";
import { codexThreadId } from "../../shared/codex";
import { newCodexChat } from "../codex/session";
import { HcAttach } from "./hc-attach";

const sessions = new Map<number, HcAttach>();
const appDisplay = () => terminalDisplay(nativeTheme.shouldUseDarkColors ? "dark" : "light");

export function registerTerminalIpc(): void {
  nativeTheme.on("updated", () => {
    const display = appDisplay();
    for (const session of sessions.values()) session.setDisplay(display);
  });
  ipcMain.handle("terminal:start", (_event, kind: unknown, cwd: unknown) => startTab(kind, cwd));
  ipcMain.handle("terminal:close", (_event, terminal: unknown) => closeTerminal(terminal));
  ipcMain.handle("terminal:attach", (e, cols: number, rows: number) => {
    const terminal = chatTerminal();
    if (codexThreadId(terminal)) return { terminal, error: "This Codex thread uses Chat." };
    const wc: WebContents = e.sender;
    const old = sessions.get(wc.id);
    old?.close();
    const a = new HcAttach({ terminal, session: process.env.CONTR_HC_SESSION, hc: process.env.CONTR_HC }, cols, rows, appDisplay(), {
      data: (bytes) => { if (!wc.isDestroyed()) wc.send("terminal:data", bytes); },
      end: (reason) => { if (!wc.isDestroyed()) wc.send("terminal:end", reason); },
    });
    if (!old) wc.once("destroyed", () => { sessions.get(wc.id)?.close(); sessions.delete(wc.id); });
    sessions.set(wc.id, a);
    return { terminal };
  });
  ipcMain.on("terminal:input", (e, text: string) => sessions.get(e.sender.id)?.input(text));
  ipcMain.on("terminal:resize", (e, cols: number, rows: number) => sessions.get(e.sender.id)?.resize(cols, rows));
}

async function closeTerminal(terminal: unknown): Promise<TerminalClose> {
  if (typeof terminal !== "string" || !terminal.trim()) return { error: "A terminal address is required." };
  if (codexThreadId(terminal)) return { error: "This Codex thread uses Chat." };
  try {
    const result = await hcCommand<{ state?: string }>("terminal.kill", { terminal });
    if (result?.state !== "finished") return { error: "hc did not confirm that the terminal ended." };
  } catch (error) {
    if (!(error instanceof HcRequestError && error.kind === "not_found")) return { error: (error as Error).message };
  }
  return { ok: true };
}

async function startTab(kind: unknown, cwd: unknown): Promise<TerminalStart> {
  if (kind !== "claude" && kind !== "codex" && kind !== "shell") return { error: "Unknown terminal program" };
  if (cwd !== null && (typeof cwd !== "string" || !isAbsolute(cwd))) return { error: "The terminal needs an absolute folder path" };
  const folder = cwd ?? homedir();
  if (kind === "codex") {
    try { return { terminal: await newCodexChat(folder) }; }
    catch (error) { return { error: (error as Error).message }; }
  }
  return runTerminal(kind === "shell" ? [] : [kind], folder);
}

async function runTerminal(argv: string[], cwd: string): Promise<TerminalStart> {
  try {
    return { terminal: await runHcTerminal({ argv, cwd, no_parent: true, display: appDisplay() }) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
