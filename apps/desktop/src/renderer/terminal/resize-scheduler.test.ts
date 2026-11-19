// Adapted from generalaction/emdash@9e2942b8281b17703c0e66845080a556ae262677
// apps/emdash-desktop/src/core/features/terminals/browser/pty/resize-scheduler.test.ts (Apache-2.0)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResizeScheduler } from "./resize-scheduler";

describe("createResizeScheduler", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
  afterEach(() => vi.useRealTimers());

  it("fits immediately and fits a lone resize only once", () => {
    const fit = vi.fn();
    const scheduler = createResizeScheduler(fit);
    scheduler.schedule();
    expect(fit).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(32);
    expect(fit).toHaveBeenCalledOnce();
  });

  it("coalesces a burst and fits the last size at the end of the interval", () => {
    let width = 100;
    const fit = vi.fn(() => width);
    const scheduler = createResizeScheduler(fit);
    scheduler.schedule();
    vi.advanceTimersByTime(12);
    width = 200;
    scheduler.schedule();
    width = 300;
    scheduler.schedule();
    vi.advanceTimersByTime(19);
    expect(fit).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(fit.mock.results.map(({ value }) => value)).toEqual([100, 300]);
    vi.advanceTimersByTime(32);
    scheduler.schedule();
    expect(fit).toHaveBeenCalledTimes(3);
  });

  it("drops a pending fit on teardown", () => {
    const fit = vi.fn();
    const scheduler = createResizeScheduler(fit);
    scheduler.schedule();
    scheduler.schedule();
    scheduler.cancel();
    vi.advanceTimersByTime(32);
    expect(fit).toHaveBeenCalledOnce();
  });
});
