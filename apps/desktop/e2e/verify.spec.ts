import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const e2e = import.meta.dirname;
const shot = path.resolve(e2e, "../../../tmp/shots/verify-skill.png");

test("the verify skill's script starts the app, reads the title, takes a screenshot and stops", async () => {
  test.setTimeout(90_000);
  // Its own session folder, so the test does not meet a session that a builder runs.
  const session = mkdtempSync(path.join(os.tmpdir(), "contr-verify-session-"));
  const verify = (...args: string[]) =>
    execFileSync(process.execPath, ["--no-warnings", path.join(e2e, "verify.ts"), ...args], {
      env: { ...process.env, VERIFY_SESSION: session },
      encoding: "utf8",
    }).trim();
  rmSync(shot, { force: true });
  try {
    expect(verify("start", "size=900x600")).toBe("started");
    expect(existsSync(path.join(session, "session.json"))).toBe(true);
    expect(verify("title")).toBe("contr");
    expect(verify("shot", "verify-skill")).toBe(shot);
    expect(existsSync(shot)).toBe(true);
  } finally {
    expect(verify("stop")).toBe("stopped");
  }
  expect(existsSync(path.join(session, "session.json"))).toBe(false);
  rmSync(session, { recursive: true, force: true });
});
