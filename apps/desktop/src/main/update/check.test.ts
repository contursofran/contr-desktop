import { describe, expect, it } from "vitest";
import type { UpdateState } from "../../shared/api";
import { afterCheck, singleFlight } from "./check";

const idle: UpdateState = { current: "0.1.1", dev: false, latest: "0.1.2", available: true, progress: null, downloaded: null, ready: false, error: "old", checking: true, checked: null };

describe("singleFlight", () => {
  it("gives a call while one runs that run, and runs again after it", async () => {
    let runs = 0;
    let finish = () => {};
    const check = singleFlight(() => {
      runs++;
      return new Promise<void>((r) => (finish = r));
    });
    const a = check();
    const b = check();
    expect(b).toBe(a);
    expect(runs).toBe(1);
    finish();
    await a;
    void check();
    expect(runs).toBe(2);
  });
  it("runs again after a failed run", async () => {
    let runs = 0;
    const check = singleFlight(async () => {
      runs++;
      throw new Error("no");
    });
    await expect(check()).rejects.toThrow("no");
    await expect(check()).rejects.toThrow("no");
    expect(runs).toBe(2);
  });
});

describe("afterCheck", () => {
  it("takes the release and sets latest, available, checked, and clears the error", () => {
    expect(afterCheck(idle, "0.1.3", true, true, 42)).toEqual({ take: true, change: { checking: false, checked: 42, error: null, latest: "0.1.3", available: true } });
    expect(afterCheck(idle, "0.1.1", true, false, 42).change.available).toBe(false);
    expect(afterCheck(idle, "0.1.3", false, true, 42).change.available).toBe(false);
  });
  it("keeps the release, progress and latest while a download runs", () => {
    expect(afterCheck({ ...idle, progress: 40 }, "0.1.3", true, true, 42)).toEqual({ take: false, change: { checking: false, checked: 42, error: null } });
  });
  it("keeps the ready app when a newer release appears", () => {
    expect(afterCheck({ ...idle, ready: true }, "0.1.3", true, true, 42)).toEqual({ take: false, change: { checking: false, checked: 42, error: null } });
  });
});
