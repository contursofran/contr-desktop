import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import WebSocket from "ws";
import { setTimeout as delay } from "node:timers/promises";
import { appChildren } from "../children";

type Id = string | number;
export interface Message {
  id?: Id;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message: string };
}

export class CodexRpc {
  private id = 0;
  private pending = new Map<Id, (message: Message) => void>();
  private failure?: string;

  private constructor(
    readonly binary: string, readonly endpoint: string, private socket: WebSocket,
    receive: (message: Message) => void, closed: (message: string) => void,
  ) {
    const fail = (error: string) => {
      if (this.failure) return;
      this.failure = error;
      for (const done of this.pending.values()) done({ error: { message: error } });
      closed(error);
    };
    socket.on("error", (error) => fail(error.message));
    socket.once("close", () => fail("The Codex App Server connection closed."));
    socket.on("message", (data) => {
      let msg: Message;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.method) receive(msg);
      else if (msg.id !== undefined) this.pending.get(msg.id)?.(msg);
    });
  }

  static async open(receive: (message: Message) => void, closed: (message: string) => void) {
    if (appChildren.stopping) throw new Error("The app is quitting.");
    // Use a short path to stay within the Unix socket address limit.
    const dir = await mkdtemp("/tmp/contr-codex-");
    const socket = join(dir, "rpc");
    const endpoint = "unix://" + socket;
    const binary = process.env.CONTR_CODEX ?? "codex";
    const server = appChildren.track(spawn(binary, ["app-server", "--listen", endpoint], { stdio: "ignore" }));
    let failure: string | undefined;
    server.once("error", (error) => { failure = error.message; });
    server.once("close", () => {
      failure ??= "Codex App Server stopped.";
      void rm(dir, { recursive: true, force: true }).catch(() => undefined);
    });
    let ws: WebSocket | undefined;
    try {
      // App Server has no readiness event for its Unix socket.
      const end = Date.now() + 5_000;
      while (!(await stat(socket).catch(() => null))?.isSocket()) {
        if (failure || Date.now() >= end) throw new Error(failure ?? "Codex App Server did not open its socket.");
        await delay(25);
      }
      const socketClient = ws = new WebSocket(`ws+unix://${socket}:/`, { handshakeTimeout: 5_000 });
      const rpc = new CodexRpc(binary, endpoint, socketClient, receive, (error) => {
        server.kill();
        closed(error);
      });
      await new Promise<void>((resolve, reject) => {
        socketClient.once("open", resolve);
        socketClient.once("error", reject);
      });
      await rpc.request("initialize", { clientInfo: { name: "contr", version: "0.1.0" } });
      rpc.write({ method: "initialized" });
      return rpc;
    } catch (error) {
      ws?.close();
      server.kill();
      throw error;
    }
  }

  write(message: Message): void {
    if (this.failure) throw new Error(this.failure);
    this.socket.send(JSON.stringify(message));
  }

  request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const done = (message: Message) => {
        clearTimeout(timer);
        this.pending.delete(id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result as T);
      };
      const timer = setTimeout(() => done({ error: { message: `Codex did not answer ${method} in 15 s.` } }), 15_000);
      this.pending.set(id, done);
      try { this.write({ id, method, params }); }
      catch (error) { done({ error: { message: (error as Error).message } }); }
    });
  }
}
