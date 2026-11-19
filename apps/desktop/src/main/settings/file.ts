import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

export function readSettings(file: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // Use defaults when there is no saved file.
  }
  return {};
}

export function writeSetting(file: string, key: string, value: unknown): void {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({ ...readSettings(file), [key]: value }, null, 2), { mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}
