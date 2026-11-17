import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineSplitter, readScheduler } from "./schedule";

describe("readScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads once for a burst, 500 ms after its last refresh", async () => {
    const read = vi.fn(async () => undefined);
    const refresh = readScheduler(read, 500, 2000);
    refresh();
    await vi.advanceTimersByTimeAsync(300);
    refresh();
    await vi.advanceTimersByTimeAsync(300);
    expect(read).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads within the maximum wait while refreshes come less than 500 ms apart", async () => {
    const read = vi.fn(async () => undefined);
    const refresh = readScheduler(read, 500, 2000);
    for (let i = 0; i < 10; i++) {
      refresh();
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("runs one read at a time and one more after it when a refresh comes during a read", async () => {
    const done: (() => void)[] = [];
    let running = 0;
    let most = 0;
    const read = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          most = Math.max(most, ++running);
          done.push(() => {
            running--;
            resolve();
          });
        }),
    );
    const refresh = readScheduler(read, 500, 2000);
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(read).toHaveBeenCalledTimes(1);
    done.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    done.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(most).toBe(1);
  });

  it("reads again after a read that failed", async () => {
    const read = vi.fn(async () => Promise.reject(new Error("hc gone")));
    const refresh = readScheduler(read, 500, 2000);
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("lineSplitter", () => {
  it("gives full lines and keeps a part line for the next chunk", () => {
    const lines: string[] = [];
    const feed = lineSplitter((l) => lines.push(l));
    feed('{"a":1}\n{"b"');
    expect(lines).toEqual(['{"a":1}']);
    feed(Buffer.from(':2}\n'));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });
});
