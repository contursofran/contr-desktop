import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export default function setupTempDir(): () => void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ce-"));
  // The workers, Electron and its child programs all inherit this folder.
  const keys = ["TMPDIR", "TMP", "TEMP"] as const;
  const previous = keys.map((key) => process.env[key]);
  for (const key of keys) process.env[key] = dir;

  return () => {
    for (const [index, key] of keys.entries()) {
      const value = previous[index];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  };
}
