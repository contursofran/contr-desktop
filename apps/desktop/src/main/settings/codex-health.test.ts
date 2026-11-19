import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CODEX_ORCHESTRATION_RULE } from "../../shared/codex-rule";
import { readCodexHealth } from "./codex-health";

describe("Codex orchestration health", () => {
  let home: string;
  let standard: string;
  let override: string;

  beforeEach(() => {
    home = mkdtempSync(path.join(os.tmpdir(), "contr-codex-health-"));
    standard = path.join(home, "AGENTS.md");
    override = path.join(home, "AGENTS.override.md");
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it("finds the standard rule through a symlink and skips an empty override", async () => {
    const actual = path.join(home, "instructions.md");
    writeFileSync(actual, `# Work\r\n\r\n${CODEX_ORCHESTRATION_RULE.replaceAll("\n", "\r\n")}`);
    symlinkSync(actual, standard, "file");
    writeFileSync(override, " \n");
    expect(await readCodexHealth(home)).toEqual({ file: standard, status: "present" });
  });

  it("checks the nonempty override even when the default file has the rule", async () => {
    writeFileSync(standard, CODEX_ORCHESTRATION_RULE);
    writeFileSync(override, "## Contr orchestration\n\nUse contr.");
    expect(await readCodexHealth(home)).toEqual({ file: override, status: "missing" });
  });

  it("reports the expected path when both files are absent", async () => {
    expect(await readCodexHealth(home)).toEqual({ file: standard, status: "missing" });
  });

  it("reports an unreadable override", async () => {
    mkdirSync(override);
    expect(await readCodexHealth(home)).toEqual({ file: override, status: "unreadable" });
  });
});
