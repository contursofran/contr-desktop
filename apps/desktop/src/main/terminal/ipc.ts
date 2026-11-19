// The Terminal side's IPC. It shows the chat's terminal (the selected agent, see ../helper),
// in the hc session that CONTR_HC_SESSION names (empty: hc's default session), with the hc program that CONTR_HC names (else `hc`).
import { ipcMain, nativeTheme, type WebContents } from "electron";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";
import type { TerminalStart } from "../../shared/api";
import { terminalDisplay } from "../../shared/terminal-display";
import { appChildren } from "../children";
import { chatTerminal } from "../helper";
import { codexThreadId } from "../../shared/codex";
import { codexSession, newCodexChat } from "../codex/session";
import { HcAttach } from "./hc-attach";

const sessions = new Map<number, HcAttach>();
const appDisplay = () => terminalDisplay(nativeTheme.shouldUseDarkColors ? "dark" : "light");

export function registerTerminalIpc(): void {
  nativeTheme.on("updated", () => {
    const display = appDisplay();
    for (const session of sessions.values()) session.setDisplay(display);
  });
  ipcMain.handle("terminal:start", (_event, kind: unknown, cwd: unknown) => startTab(kind, cwd));
  const attaching = new WeakMap<WebContents, symbol>();
  const watched = new WeakSet<WebContents>();
  ipcMain.handle("terminal:attach", async (e, cols: number, rows: number) => {
    const tab = chatTerminal();
    const wc = e.sender;
    sessions.get(wc.id)?.close();
    sessions.delete(wc.id);
    if (!watched.has(wc)) {
      watched.add(wc);
      wc.once("destroyed", () => { sessions.get(wc.id)?.close(); sessions.delete(wc.id); });
    }
    const attachId = Symbol();
    attaching.set(e.sender, attachId);
    let terminal = tab;
    if (codexThreadId(tab)) {
      try {
        const session = await codexSession(tab);
        if (!session.resumable) return { terminal: tab, error: "Send a message in Chat before opening the Codex terminal." };
        session.companion ??= runTerminal([session.rpc.binary, "resume", "--remote", session.rpc.endpoint, session.threadId], session.cwd)
          .then((result) => {
            if ("error" in result) throw new Error(result.error);
            return result.terminal;
          }).catch((error: unknown) => {
            session.companion = undefined;
            throw error;
          });
        terminal = await session.companion;
      } catch (error) { return { terminal: tab, error: (error as Error).message }; }
      if (e.sender.isDestroyed() || tab !== chatTerminal() || attaching.get(e.sender) !== attachId) return { terminal };
    }
    const a = new HcAttach({ terminal, session: process.env.CONTR_HC_SESSION, hc: process.env.CONTR_HC }, cols, rows, appDisplay(), {
      data: (bytes) => { if (!wc.isDestroyed()) wc.send("terminal:data", bytes); },
      end: (reason) => { if (!wc.isDestroyed()) wc.send("terminal:end", reason); },
    });
    sessions.set(wc.id, a);
    return { terminal };
  });
  ipcMain.on("terminal:input", (e, text: string) => sessions.get(e.sender.id)?.input(text));
  ipcMain.on("terminal:resize", (e, cols: number, rows: number) => sessions.get(e.sender.id)?.resize(cols, rows));
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

function runTerminal(argv: string[], cwd: string): Promise<TerminalStart> {
  const session = process.env.CONTR_HC_SESSION;
  const args = session ? ["connect", "--session", session] : ["connect"];
  // Codex queries the terminal's colors at startup, which can finish before the view attaches.
  const request = {
    jsonrpc: "2.0", id: 1, method: "terminal.run",
    params: { argv, cwd, no_parent: true, display: appDisplay() },
  };
  return new Promise((resolve) => {
    const child = appChildren.execFile(process.env.CONTR_HC ?? "hc", args, { encoding: "utf8", timeout: 10_000 }, (error, out, stderr) => {
      if (error) return resolve({ error: error.killed ? "no answer in 10 s" : stderr.trim() || error.message });
      try {
        const reply = JSON.parse(out) as { result?: { address?: unknown }; error?: { message?: string } } | null;
        if (reply?.error?.message) return resolve({ error: reply.error.message });
        const address = reply?.result?.address;
        resolve(typeof address === "string" && address ? { terminal: address } : { error: "hc gave no terminal address" });
      } catch {
        resolve({ error: "hc gave no JSON" });
      }
    });
    if (!child?.stdin || !child.stdout) return;
    child.stdin.on("error", () => undefined);
    // Keep the connection open until hc answers, then let it exit.
    createInterface({ input: child.stdout }).once("line", () => child.stdin?.end());
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}
