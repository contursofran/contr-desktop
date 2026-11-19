import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CodexHealth } from "../../shared/api";
import { CODEX_ORCHESTRATION_RULE } from "../../shared/codex-rule";

const normalize = (text: string) => text.trim().replace(/\s+/g, " ");
const rule = normalize(CODEX_ORCHESTRATION_RULE);

/** Codex uses the first nonempty global file, with the override first. */
export async function readCodexHealth(home: string): Promise<CodexHealth> {
  const standard = path.join(home, "AGENTS.md");
  for (const file of [path.join(home, "AGENTS.override.md"), standard]) {
    try {
      const instructions = await readFile(file, "utf8");
      if (!instructions.trim() && file !== standard) continue;
      const present = instructions.split(/^## /m).some((section, index) =>
        index > 0 && normalize(`## ${section}`).startsWith(rule),
      );
      return { file, status: present ? "present" : "missing" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      return { file, status: "unreadable" };
    }
  }
  return { file: standard, status: "missing" };
}
