import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { terminalDisplay } from "../../shared/terminal-display";
import { decodeAll, encode, KIND_DATA, KIND_FACTS, KIND_RESIZE, resizePayload } from "./frames";

// A fake `hc connect`: an event emitter with fake streams. Its stdin keeps each write; `broken` makes a write fail with EPIPE.
class FakeProc extends EventEmitter {
  writes: Buffer[] = [];
  broken = false;
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new Writable({
    write: (chunk: Buffer, _enc, cb) => {
      if (this.broken) return cb(Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
      this.writes.push(Buffer.from(chunk));
      cb();
    },
  });
  kill = vi.fn();
}

let proc: FakeProc;
vi.mock("node:child_process", () => ({ spawn: () => proc }));
const { HcAttach, NOT_JSON } = await import("./hc-attach");

const tick = () => new Promise((r) => setImmediate(r));
const hello = `${JSON.stringify({ jsonrpc: "2.0", id: 0, result: {} })}\n`;
const reply = (m: object) => encode(0, KIND_DATA, Buffer.from(JSON.stringify(m)));

function attach() {
  const on = { data: vi.fn(), end: vi.fn() };
  const a = new HcAttach({ terminal: "t7" }, 80, 24, terminalDisplay("dark"), on);
  return { a, on };
}

/** An attach with channel 1 open. */
async function open() {
  const x = attach();
  proc.stdout.write(hello);
  proc.stdout.write(reply({ jsonrpc: "2.0", id: 1, result: { channel: 1 } }));
  await tick();
  return x;
}

beforeEach(() => (proc = new FakeProc()));
afterEach(() => vi.restoreAllMocks());

describe("HcAttach", () => {
  it("ends with a plain reason when the hello line is not JSON", async () => {
    const { on } = attach();
    proc.stdout.write("warning: a newer hc is installed\n");
    await tick();
    expect(on.end).toHaveBeenCalledExactlyOnceWith(NOT_JSON);
    expect(proc.kill).toHaveBeenCalled();
  });

  it("ends with a plain reason when the hello line is JSON but not an object", async () => {
    const { on } = attach();
    proc.stdout.write("null\n");
    await tick();
    expect(on.end).toHaveBeenCalledExactlyOnceWith(NOT_JSON);
  });

  it("ends with a plain reason when a channel-0 frame is not JSON, and reads no more", async () => {
    const { on } = attach();
    proc.stdout.write(hello);
    proc.stdout.write(encode(0, KIND_DATA, Buffer.from("not json")));
    await tick();
    expect(on.end).toHaveBeenCalledExactlyOnceWith(NOT_JSON);
    proc.stdout.write(encode(1, KIND_DATA, Buffer.from("late")));
    await tick();
    expect(on.data).not.toHaveBeenCalled();
    expect(on.end).toHaveBeenCalledOnce();
  });

  it("sends the terminal's bytes when the attach opens", async () => {
    const { on } = await open();
    proc.stdout.write(encode(1, KIND_DATA, Buffer.from("hi")));
    await tick();
    expect(on.data.mock.calls.map(([b]) => Buffer.from(b as Uint8Array).toString())).toEqual(["hi"]);
    expect(on.end).not.toHaveBeenCalled();
  });

  it("sends the initial grid on attach and the latest changed grid as soon as the channel opens", async () => {
    const { a } = attach();
    a.resize(90, 28);
    proc.stdout.write(hello);
    a.resize(100, 30);
    expect(proc.writes).toHaveLength(2);
    const [request] = decodeAll(proc.writes[1]!).frames;
    expect(JSON.parse(request!.payload.toString()).params).toMatchObject({ cols: 80, rows: 24 });

    proc.stdout.write(reply({ jsonrpc: "2.0", id: 1, result: { channel: 1 } }));
    await tick();
    a.resize(100, 30);
    a.resize(100, 31);
    a.resize(100, 31);
    expect(proc.writes.slice(2)).toEqual([
      encode(1, KIND_RESIZE, resizePayload(100, 30)),
      encode(1, KIND_RESIZE, resizePayload(100, 31)),
    ]);
  });

  it("reports the current display on attach and sends changes on the open channel", async () => {
    const { a } = attach();
    const light = terminalDisplay("light");
    const dark = terminalDisplay("dark");
    a.setDisplay(light);
    proc.stdout.write(hello);
    const [request] = decodeAll(proc.writes[1]!).frames;
    expect(JSON.parse(request!.payload.toString()).params.display).toEqual(light);

    a.setDisplay(dark);
    expect(proc.writes).toHaveLength(2);
    proc.stdout.write(reply({ jsonrpc: "2.0", id: 1, result: { channel: 1 } }));
    await tick();
    a.setDisplay(dark);
    a.setDisplay(light);
    expect(proc.writes.slice(2)).toEqual([
      encode(1, KIND_FACTS, Buffer.from(JSON.stringify(dark))),
      encode(1, KIND_FACTS, Buffer.from(JSON.stringify(light))),
    ]);
  });

  it("skips the pending resize when the grid returns to the attach size", async () => {
    const { a } = attach();
    proc.stdout.write(hello);
    a.resize(100, 30);
    a.resize(80, 24);
    proc.stdout.write(reply({ jsonrpc: "2.0", id: 1, result: { channel: 1 } }));
    await tick();
    expect(proc.writes).toHaveLength(2);
  });

  it("does not throw when a write fails because hc closed its stdin (EPIPE)", async () => {
    const { a, on } = await open();
    proc.broken = true;
    a.input("x");
    await tick();
    expect(proc.stdin.listenerCount("error")).toBeGreaterThan(0);
    // hc's exit gives the reason, as for any other end.
    proc.emit("close");
    expect(on.end).toHaveBeenCalledExactlyOnceWith("hc closed the connection");
  });

  it("writes nothing for input, resize and close after the end", async () => {
    const { a, on } = await open();
    proc.emit("close");
    expect(on.end).toHaveBeenCalledOnce();
    const write = vi.spyOn(proc.stdin, "write");
    const end = vi.spyOn(proc.stdin, "end");
    a.input("x");
    a.resize(100, 30);
    a.close();
    expect(write).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it("writes nothing after a detach", async () => {
    const { a } = await open();
    a.close();
    const write = vi.spyOn(proc.stdin, "write");
    a.input("x");
    a.resize(100, 30);
    a.close();
    expect(write).not.toHaveBeenCalled();
  });
});
