import { readFileSync } from "node:fs";
import path from "node:path";
import type { InstallRecord } from "./root";

/** A core build: the short commit sha and its date (YYYY-MM-DD). */
export interface Stamp {
  sha: string;
  date: string;
}

const SHA = /^[0-9a-f]{7}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The stamp of a release tag `build-YYYY-MM-DD-<sha7>`, else null. */
export function stampOfTag(tag: string | null | undefined): Stamp | null {
  const m = /^build-(\d{4}-\d{2}-\d{2})-([0-9a-f]{7})$/.exec(tag?.trim() ?? "");
  return m ? { sha: m[2]!, date: m[1]! } : null;
}

/** The stamp of the core's build text `<sha7> <date>` (`install.json` `build`), else null. */
export function parseStamp(text: string | null | undefined): Stamp | null {
  const [sha, date, ...more] = text?.trim().split(" ") ?? [];
  return sha && date && more.length === 0 && SHA.test(sha) && DATE.test(date) ? { sha, date } : null;
}

/**
 * The home's build against the bundle's: `older` means the home is older. The same sha is `same`; else the
 * dates decide. The same date with another sha, or a side that is not known, is `unknown`.
 */
export function coreOrder(bundle: Stamp | null, home: Stamp | null): "same" | "older" | "newer" | "unknown" {
  if (!bundle || !home) return "unknown";
  if (bundle.sha === home.sha) return "same";
  if (bundle.date === home.date) return "unknown";
  return home.date < bundle.date ? "older" : "newer";
}

/** The bundle's release tag (the file `RELEASE`, from scripts/fetch-helper), else null. */
export function readBundleTag(dir: string): string | null {
  try {
    return readFileSync(path.join(dir, "RELEASE"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

/** `<root>/install.json`: its `build` and the number of keys in `files`. Null when there is no such file or it is not JSON. */
export function readInstalled(root: string): InstallRecord | null {
  try {
    const data = JSON.parse(readFileSync(path.join(root, "install.json"), "utf8")) as { build?: unknown; files?: unknown };
    const files = data.files && typeof data.files === "object" ? Object.keys(data.files).length : 0;
    return { build: typeof data.build === "string" ? data.build : null, modFiles: files };
  } catch {
    return null;
  }
}
