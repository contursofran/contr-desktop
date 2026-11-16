// One attach to an hc terminal through `hc connect`: `hello` with `framed`, then `terminal.attach`.
// Keys, paste and size go to hc; the terminal's bytes come back. No polling: hc pushes the bytes.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { decodeAll, encode, KIND_CLOSE, KIND_DATA, KIND_RESIZE, resizePayload } from "./frames";

export interface AttachTarget {
  /** The terminal address or name, like `t1`. */
  terminal: string;
  /** The hc session. Empty: hc's default session. */
  session?: string;
  /** The hc program. */
  hc?: string;
}

export interface AttachEvents {
  data(bytes: Uint8Array): void;
  /** The stream ended: the terminal finished, or an error. */
  end(reason: string): void;
}

export class HcAttach {
  private proc: ChildProcessWithoutNullStreams;
  private buf: Buffer = Buffer.alloc(0);
  private framed = false;
  private channel = 0;
  private ended = false;
  /** Keys typed before the attach reply: sent when the channel opens. */
  private pending: string[] = [];

  constructor(target: AttachTarget, cols: number, rows: number, private on: AttachEvents) {
    const args = ["connect", ...(target.session ? ["--session", target.session] : [])];
    this.proc = spawn(target.hc ?? "hc", args, { stdio: "pipe" });
    this.proc.on("error", (e) => this.finish(`hc: ${e.message}`));
    this.proc.on("exit", () => this.finish("hc closed the connection"));
    this.proc.stdout.on("data", (d: Buffer) => this.read(d, target.terminal, cols, rows));
    this.rpc(0, "hello", { generation: 1, framed: true }, true);
  }

  input(text: string): void {
    if (this.channel) this.proc.stdin.write(encode(this.channel, KIND_DATA, Buffer.from(text)));
    else this.pending.push(text);
  }

  resize(cols: number, rows: number): void {
    if (this.channel) this.proc.stdin.write(encode(this.channel, KIND_RESIZE, resizePayload(cols, rows)));
  }

  /** Detach. The terminal keeps running. */
  close(): void {
    if (this.channel) this.proc.stdin.write(encode(this.channel, KIND_CLOSE));
    this.proc.stdin.end();
    this.ended = true;
  }

  private rpc(id: number, method: string, params: object, line = false): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    this.proc.stdin.write(line ? `${msg}\n` : encode(0, KIND_DATA, Buffer.from(msg)));
  }

  private read(d: Buffer, terminal: string, cols: number, rows: number): void {
    this.buf = Buffer.concat([this.buf, d]);
    if (!this.framed) {
      const nl = this.buf.indexOf(10);
      if (nl < 0) return;
      const hello = JSON.parse(this.buf.subarray(0, nl).toString()) as { error?: { message: string } };
      this.buf = this.buf.subarray(nl + 1);
      if (hello.error) return this.finish(hello.error.message);
      this.framed = true;
      // history: the scrollback that is shown first, so the owner can scroll back at once.
      this.rpc(1, "terminal.attach", { terminal, cols, rows, history: 1000 });
    }
    const { frames, rest } = decodeAll(this.buf);
    this.buf = rest;
    for (const f of frames) {
      if (f.channel === 0) {
        const m = JSON.parse(f.payload.toString()) as { id?: number; result?: { channel: number }; error?: { message: string } };
        if (m.id !== 1) continue;
        if (m.error || !m.result) return this.finish(m.error?.message ?? "attach failed");
        this.channel = m.result.channel;
        for (const text of this.pending.splice(0)) this.input(text);
      } else if (f.channel === this.channel) {
        if (f.kind === KIND_DATA) this.on.data(f.payload);
        else if (f.kind === KIND_CLOSE) return this.finish("the terminal stream ended");
      }
    }
  }

  private finish(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.on.end(reason);
    this.proc.kill();
  }
}
