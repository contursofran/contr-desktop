import { describe, expect, it, vi } from "vitest";
import { CORE_INSTALL_TIMEOUT_MS, installCore, type Run } from "./install";

const ok: Run = async () => ({ code: 0, output: "Done.\n", error: null });

describe("installCore", () => {
  it("with no tool the install has no --orch", async () => {
    const run = vi.fn(ok);
    expect(await installCore("/b/herdr-contr-feed", null, "/tmp/core", run, {})).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith("/b/herdr-contr-feed", ["install", "--backend", "--helper", "/b/herdr-contr-feed"], {
      env: { CONTR_HOME: "/tmp/core" },
      timeout: CORE_INSTALL_TIMEOUT_MS,
    });
  });
  it("with a tool the install passes --orch", async () => {
    const run = vi.fn(ok);
    await installCore("/b/herdr-contr-feed", "/b/herdr-contr-orch", "/tmp/core", run, {});
    expect(run.mock.calls[0]![1]).toEqual(["install", "--backend", "--helper", "/b/herdr-contr-feed", "--orch", "/b/herdr-contr-orch"]);
  });
  it("the message is the STOP line", async () => {
    const run: Run = async () => ({ code: 1, output: "STOP: fake\nsee the log\n", error: "Command failed" });
    expect(await installCore("/b/h", null, "/tmp/core", run, {})).toEqual({ ok: false, message: "STOP: fake" });
  });
  it("with no STOP line the message is the last line, else the process error", async () => {
    const last: Run = async () => ({ code: 2, output: "usage\nbad argument --x\n\n", error: "Command failed" });
    expect(await installCore("/b/h", null, "/tmp/core", last, {})).toEqual({ ok: false, message: "bad argument --x" });
    const none: Run = async () => ({ code: null, output: "\n", error: "spawn ENOENT" });
    expect(await installCore("/b/h", null, "/tmp/core", none, {})).toEqual({ ok: false, message: "spawn ENOENT" });
  });
});
