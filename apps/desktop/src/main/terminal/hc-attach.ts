// One attach to an hc terminal through `hc connect`: `hello` with `framed`, then `terminal.attach`.
// Keys, paste and size go to hc; the terminal's bytes come back. No polling: hc pushes the bytes.
import { appChildren } from "../children";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { TerminalDisplay } from "../../shared/terminal-display";
import { decodeAll, encode, KIND_CLOSE, KIND_DATA, KIND_FACTS, KIND_RESIZE, resizePayload } from "./frames";

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

/** The end reason when a line or a channel-0 frame from hc is not JSON (a warning, another protocol version). */
export const NOT_JSON = "hc sent data that is not JSON";

/** A JSON object from hc, or undefined when the bytes are not JSON or not an object. */
function parse<T extends object>(bytes: Buffer): T | undefined {
  try {
    const v: unknown = JSON.parse(bytes.toString());
    return typeof v === "object" && v !== null ? (v as T) : undefined;
  } catch {
    return undefined;
  }
}

export class HcAttach {
  private proc: ChildProcessWithoutNullStreams;
  private buf: Buffer = Buffer.alloc(0);
  private framed = false;
  private channel = 0;
  private ended = false;
  /** Keys typed before the attach reply: sent when the channel opens. */
  private pending: string[] = [];
  /** Last size sent, or the initial size that terminal.attach will send. */
  private size: { cols: number; rows: number };
  /** Latest size while terminal.attach is still opening. */
  private pendingSize?: { cols: number; rows: number };
  private sentDisplay?: TerminalDisplay;
  /** hc's own words when it exits with an error. */
  private stderr = "";

  constructor(target: AttachTarget, cols: number, rows: number, private display: TerminalDisplay, private on: AttachEvents) {
    this.size = { cols, rows };
    const args = ["connect", ...(target.session ? ["--session", target.session] : [])];
    this.proc = appChildren.track(spawn(target.hc ?? "hc", args, { stdio: "pipe" }));
    this.proc.on("error", (e) => this.finish(`hc: ${e.message}`));
    this.proc.stderr.on("data", (d: Buffer) => (this.stderr += d.toString()));
    // A write after hc closed its stdin (EPIPE) must not throw in the main process: the `close` event gives the reason.
    this.proc.stdin.on("error", () => undefined);
    // `close`, not `exit`: an error line on stdout or stderr is read before the end.
    this.proc.on("close", () => this.finish(this.stderr.trim() ? `hc closed the connection: ${this.stderr.trim()}` : "hc closed the connection"));
    this.proc.stdout.on("data", (d: Buffer) => this.read(d, target.terminal));
    this.rpc(0, "hello", { generation: 1, framed: true }, true);
  }

  setDisplay(display: TerminalDisplay): void {
    if (this.ended) return;
    this.display = display;
    this.sendDisplay();
  }

  private sendDisplay(): void {
    if (!this.channel || this.display === this.sentDisplay) return;
    this.sentDisplay = this.display;
    this.proc.stdin.write(encode(this.channel, KIND_FACTS, Buffer.from(JSON.stringify(this.display))));
  }

  input(text: string): void {
    if (this.ended) return;
    if (this.channel) this.proc.stdin.write(encode(this.channel, KIND_DATA, Buffer.from(text)));
    else this.pending.push(text);
  }

  resize(cols: number, rows: number): void {
    if (this.ended) return;
    const changed = cols !== this.size.cols || rows !== this.size.rows;
    if (!this.channel) {
      this.pendingSize = changed ? { cols, rows } : undefined;
    } else if (changed) {
      this.size = { cols, rows };
      this.proc.stdin.write(encode(this.channel, KIND_RESIZE, resizePayload(cols, rows)));
    }
  }

  /** Detach. The terminal keeps running. */
  close(): void {
    if (this.ended) return;
    if (this.channel) this.proc.stdin.write(encode(this.channel, KIND_CLOSE));
    this.proc.stdin.end();
    this.ended = true;
  }

  private rpc(id: number, method: string, params: object, line = false): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    this.proc.stdin.write(line ? `${msg}\n` : encode(0, KIND_DATA, Buffer.from(msg)));
  }

  private read(d: Buffer, terminal: string): void {
    if (this.ended) return;
    this.buf = Buffer.concat([this.buf, d]);
    if (!this.framed) {
      const nl = this.buf.indexOf(10);
      if (nl < 0) return;
      const hello = parse<{ error?: { message: string } }>(this.buf.subarray(0, nl));
      if (!hello) return this.finish(NOT_JSON);
      this.buf = this.buf.subarray(nl + 1);
      if (hello.error) return this.finish(hello.error.message);
      this.framed = true;
      // history: the scrollback that is shown first, so the owner can scroll back at once.
      this.sentDisplay = this.display;
      this.rpc(1, "terminal.attach", { terminal, ...this.size, history: 1000, display: this.display });
    }
    const { frames, rest } = decodeAll(this.buf);
    this.buf = rest;
    for (const f of frames) {
      if (f.channel === 0) {
        const m = parse<{ id?: number; result?: { channel: number }; error?: { message: string } }>(f.payload);
        if (!m) return this.finish(NOT_JSON);
        if (m.id !== 1) continue;
        if (m.error || !m.result) return this.finish(m.error?.message ?? "attach failed");
        this.channel = m.result.channel;
        this.sendDisplay();
        const size = this.pendingSize;
        this.pendingSize = undefined;
        if (size) this.resize(size.cols, size.rows);
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
