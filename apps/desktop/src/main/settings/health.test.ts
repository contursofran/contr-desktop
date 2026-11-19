import { describe, expect, it, vi } from "vitest";
import { healthReport, helperChecks } from "./health";

const head = { type: "header", protocol: 1 };
const end = { type: "end", ok: true };
const check = (id: string, message: string) => ({ type: "check", id, message, state: "ok", fix: "" });

describe("machine health", () => {
  it("reports each connected machine and skips the offline one", async () => {
    const helper = vi.fn(async (machine?: string) => [head, check("helper", machine ?? "Mac"), end]);
    const data = await healthReport(helper, Promise.resolve([{ name: "pc", state: "connected" }, { name: "other", state: "unreachable" }]));
    expect(data.machines.map(({ name, checks }) => [name, checks[0].state])).toEqual([["This computer", "ok"], ["pc", "ok"], ["other", "fail"]]);
    expect(data.machines[1].checks[0].message).toBe("pc");
    expect(helper.mock.calls).toEqual([[], ["pc"]]);
  });

  it("does not pass an old local helper's results off as remote checks", async () => {
    const helper = vi.fn(async () => [head, check("orch", "Mac binary"), end]);
    const data = await healthReport(helper, Promise.resolve([{ name: "pc", state: "connected" }]));
    expect(helper).toHaveBeenCalledTimes(1);
    expect(data.machines[0].checks[0].state).toBe("warn");
    expect(data.machines[1].checks[0].message).toBe("Setup has not been checked.");
  });

  it("reports a failed machine listing and an incompatible helper", async () => {
    const data = await healthReport(async () => [{ ...head, protocol: 2 }, end], Promise.resolve(null));
    expect(data.machines[0].checks.map((row) => [row.id, row.state])).toEqual([["helper", "fail"], ["machines", "fail"]]);
    expect(helperChecks([{ type: "error", message: "No helper on the PC" }], true)[0].message).toBe("No helper on the PC");
  });
});
