import { describe, expect, it } from "vitest";
import { countLiveWorkers, liveWorkerParents } from "./live";

const term = (address: string, extra: Record<string, unknown> = {}) => ({ address, state: "live", status: "working", ...extra });
const hc = (...t: object[]) => JSON.stringify({ terminals: t });

describe("liveWorkerParents", () => {
  it("counts a worker that the tool says is live and that hc shows", () => {
    const h = hc(term("t1"), term("t2"));
    const o = JSON.stringify([{ name: "b-2", address: "t2", parent: "t1", live: true }]);
    expect(countLiveWorkers(h, o, "t1")).toBe(1);
  });
  it("skips a worker that the tool says is not live, even when hc shows it", () => {
    const h = hc(term("t1"), term("t2", { parent: "t1" }));
    const o = JSON.stringify([{ name: "b-2", address: "t2", parent: "t1", live: false }]);
    expect(countLiveWorkers(h, o, "t1")).toBe(0);
  });
  it("skips a live tool entry whose terminal is gone from hc", () => {
    const o = JSON.stringify([
      { name: "b-2", address: "t2", parent: "t1", live: true },
      { name: "b-3", parent: "t1", live: true },
    ]);
    expect(countLiveWorkers(hc(term("t1")), o, "t1")).toBe(0);
    expect(countLiveWorkers(hc(term("t1"), term("t2", { state: "finished" })), o, "t1")).toBe(0);
  });
  it("counts only the workers of the given parent, the tool's parent first, else hc's", () => {
    const h = hc(term("t1"), term("t2", { parent: "t9" }), term("t3", { parent: "t1" }), term("t4", { parent: "t9" }));
    const o = JSON.stringify([{ address: "t2", parent: "t1", live: true }]);
    expect(liveWorkerParents(h, o)).toEqual(new Map([["t2", "t1"], ["t3", "t1"], ["t4", "t9"]]));
    expect(countLiveWorkers(h, o, "t1")).toBe(2);
    expect(countLiveWorkers(h, o, "t9")).toBe(1);
    expect(countLiveWorkers("oops", "oops", "t1")).toBe(0);
  });
});
