import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readTabDetails, readTitle, tabTitle } from "./title";

const fakeHc = path.resolve(import.meta.dirname, "../../../e2e/fake-hc.mjs");

describe("readTitle", () => {
  it("uses the title", () => expect(readTitle('{"title":"Audit","name":"w-1"}', "t7")).toBe("Audit"));
  it("falls back to the name", () => expect(readTitle('{"title":"","name":"w-1"}', "t7")).toBe("w-1"));
  it("falls back to the terminal when hc fails", () =>
    expect(readTitle('{"error":{"kind":"not_found"}}', "t7")).toBe("t7"));
  it("falls back to the terminal when the answer is not JSON", () => expect(readTitle("", "t7")).toBe("t7"));
});

describe("readTabDetails", () => {
  it("uses the title and program", () => expect(readTabDetails('{"title":"Audit","agent":"codex","address":"t7"}')).toEqual({ title: "Audit", kind: "codex" }));
  it("falls back to the program name", () => {
    expect(readTabDetails('{"title":"","agent":"claude-code","address":"t7"}').title).toBe("Claude Code");
    expect(readTabDetails('{"agent":"codex","address":"t7"}').title).toBe("Codex");
  });
  it("recognizes the program before hc reports an agent", () => {
    expect(readTabDetails('{"argv":["claude"]}')).toEqual({ title: "Claude Code", kind: "claude-code" });
  });
  it("never gives the terminal id", () => {
    expect(readTabDetails('{"title":"","name":"w-1","address":"t7"}').title).toBe("Terminal");
    expect(readTabDetails('{"agent":"vim","address":"t7"}').title).toBe("Terminal");
    expect(readTabDetails("").title).toBe("Terminal");
  });
});

describe("tabTitle", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("gives the title while hc lists the terminal", async () => {
    vi.stubEnv("FAKE_HC_AGENTS", "1");
    expect(await tabTitle("t11", fakeHc)).toEqual({ title: "Release notes draft", kind: "claude-code" });
  });
  it("gives gone when hc runs and does not list the terminal", async () => {
    vi.stubEnv("FAKE_HC_AGENTS", "1");
    vi.stubEnv("FAKE_HC_GONE", "t99");
    expect(await tabTitle("t99", fakeHc)).toEqual({ gone: true });
  });
  it("gives an error, not gone, when hc fails", async () => {
    const down = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-test-hc-")), "down");
    writeFileSync(down, "");
    vi.stubEnv("FAKE_HC_AGENTS", "1");
    vi.stubEnv("FAKE_HC_DOWN", down);
    expect(await tabTitle("t11", fakeHc)).toEqual({ error: "fake hc: the core is not running" });
  });
  it("gives an error, not gone, when hc get fails for a terminal that hc lists", async () => {
    vi.stubEnv("FAKE_HC_AGENTS", "1");
    vi.stubEnv("FAKE_HC_GONE", "t11");
    expect(await tabTitle("t11", fakeHc)).toMatchObject({ error: expect.any(String) });
  });
});
