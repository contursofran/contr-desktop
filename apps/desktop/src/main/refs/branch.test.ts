import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { gitBranch } from "./branch";

function fakeGit(script: string): string {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-git-")), "git");
  writeFileSync(file, `#!/bin/sh\n${script}\n`);
  chmodSync(file, 0o755);
  return file;
}

it("gives the current branch", async () => {
  expect(await gitBranch(os.tmpdir(), fakeGit('echo "agent/11-reply-menu"'))).toBe("agent/11-reply-menu");
});

it("gives null on a detached HEAD (empty answer) or an error", async () => {
  expect(await gitBranch(os.tmpdir(), fakeGit("true"))).toBeNull();
  expect(await gitBranch(os.tmpdir(), fakeGit("echo main; exit 128"))).toBeNull();
});
