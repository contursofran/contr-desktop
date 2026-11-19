import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
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
    private child: ChildProcessWithoutNullStreams,
    receive: (message: Message) => void, closed: (message: string) => void,
  ) {
    const fail = (error: string) => {
      if (this.failure) return;
      this.failure = error;
      for (const done of this.pending.values()) done({ error: { message: error } });
      closed(error);
    };
    child.once("error", (error) => fail(error.message));
    child.once("close", () => fail("The Codex App Server connection closed."));
    child.stdin.on("error", (error) => fail(error.message));
    child.stderr.resume();
    createInterface({ input: child.stdout }).on("line", (line) => {
      let msg: Message;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.method) receive(msg);
      else if (msg.id !== undefined) this.pending.get(msg.id)?.(msg);
    });
  }

  static async open(receive: (message: Message) => void, closed: (message: string) => void) {
    if (appChildren.stopping) throw new Error("The app is quitting.");
    const binary = process.env.CONTR_CODEX ?? "codex";
    const child = appChildren.track(spawn(binary, ["app-server", "--stdio"], { stdio: "pipe" }));
    const rpc = new CodexRpc(child, receive, closed);
    try {
      await rpc.request("initialize", {
        clientInfo: { name: "contr", version: "0.1.0" },
        capabilities: { experimentalApi: true },
      });
      rpc.write({ method: "initialized" });
      return rpc;
    } catch (error) {
      child.kill();
      throw error;
    }
  }

  write(message: Message): void {
    if (this.failure) throw new Error(this.failure);
    this.child.stdin.write(JSON.stringify(message) + "\n");
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
