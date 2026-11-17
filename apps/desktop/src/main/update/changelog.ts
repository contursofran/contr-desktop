import type { ChangeLog, ChangeLogRelease } from "../../shared/api";
import { CHANGELOG_COUNT, getJson, readReleaseFile, versionOf } from "./release";

export { CHANGELOG_COUNT } from "./release";

/** The "- " lines of the notes' "## Changes" part (release.yml writes it), up to the first other line. */
export function parseChanges(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "## Changes");
  if (start < 0) return [];
  const changes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" && changes.length === 0) continue;
    if (!line.startsWith("- ")) break;
    changes.push(line.slice(2).trim());
  }
  return changes;
}

/**
 * Reads the GitHub releases JSON (a list) into the newest CHANGELOG_COUNT releases, newest first by
 * `published_at`. A draft or a release with no version is left out.
 */
export function parseChangeLog(json: unknown): ChangeLogRelease[] {
  type Raw = { tag_name?: unknown; body?: unknown; draft?: unknown; published_at?: unknown };
  const list = (Array.isArray(json) ? json : []) as Raw[];
  const time = (r: Raw) => (typeof r.published_at === "string" ? Date.parse(r.published_at) || 0 : 0);
  return list
    .filter((r) => r && r.draft !== true && versionOf(r) !== null)
    .sort((a, b) => time(b) - time(a))
    .slice(0, CHANGELOG_COUNT)
    .map((r) => ({
      version: versionOf(r)!,
      tag: typeof r.tag_name === "string" ? r.tag_name : "",
      date: typeof r.published_at === "string" ? r.published_at.slice(0, 10) : "",
      changes: parseChanges(typeof r.body === "string" ? r.body : ""),
    }));
}

/**
 * Keeps the change log in memory. `load` reads it (one read at a time): release.json at `file`, else (no `file`,
 * or no such file) the API list at `url`. An update check that read release.json gives its releases with `put`;
 * else it calls `load`. There is no timer of its own. `get` gives the running read, else the last result; with
 * `again`, or before the first read, it starts a read. A failed read keeps the releases of the last good one. With
 * no `file` and no `url` (dev, e2e with no fake URL) there is nothing to read: `releases` stays null.
 */
export function changeLogSource(url: string | null, get: typeof fetch = fetch, file: string | null = null) {
  let last: ChangeLog = { releases: null, error: null };
  let running: Promise<ChangeLog> | null = null;
  let read = false;
  const fromFile = async () => (file ? ((await readReleaseFile(file, get))?.releases ?? null) : null);
  const load = (): Promise<ChangeLog> => {
    if (!url && !file) return Promise.resolve(last);
    read = true;
    return (running ??= fromFile()
      .then(async (releases) => releases ?? (url ? parseChangeLog(await getJson(url, get)) : []))
      .then(
        (releases): ChangeLog => ({ releases, error: null }),
        (e): ChangeLog => ({ releases: last.releases, error: `Could not load the change log: ${(e as Error).message}` }),
      )
      .then((result) => {
        last = result;
        running = null;
        return result;
      }));
  };
  return {
    load,
    put: (releases: ChangeLogRelease[]) => {
      read = true;
      if (!running) last = { releases, error: null };
    },
    get: (again = false): Promise<ChangeLog> => (again || !read ? load() : (running ?? Promise.resolve(last))),
  };
}
