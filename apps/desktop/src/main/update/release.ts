import type { ChangeLogRelease } from "../../shared/api";
export { newer } from "../../shared/version";

/** The releases of contr-desktop. The repository is public: the API needs no token. */
const REPO_API = "https://api.github.com/repos/contursofran/contr-desktop";
/**
 * release.json of the newest release (release.yml writes it; docs/reference/releases.md). GitHub redirects this URL
 * to the file; it is not under the API's rate limit of 60 reads in an hour for one network address.
 */
export const RELEASE_FILE_URL = "https://github.com/contursofran/contr-desktop/releases/latest/download/release.json";
/** Settings > Change log shows this many releases. */
export const CHANGELOG_COUNT = 10;
/** The newest release (API). */
export const RELEASE_URL = `${REPO_API}/releases/latest`;
/** The releases for the change log. The API lists them by tag name, not by time, so the change log reads 100 and sorts them. */
export const RELEASES_URL = `${REPO_API}/releases?per_page=100`;
/** The .dmg's name does not change between releases (docs/reference/releases.md). */
export const DMG = "contr-mac-universal.dmg";
/** The .zip that the Update button installs from (docs/reference/releases.md). */
export const ZIP = "contr-mac-universal.zip";

export interface Release {
  version: string;
  dmgUrl: string | null;
  zipUrl: string | null;
  sha256: string | null;
}

/**
 * Reads a GitHub release JSON. The tag is build-<date>-<sha7>, so the version comes from the notes,
 * "contr 0.1.<run> from <sha>." (release.yml), else from the name. Throws when no version is found.
 */
export function parseRelease(json: unknown): Release {
  const r = json as { assets?: { name?: unknown; browser_download_url?: unknown }[] };
  const version = versionOf(json);
  if (!version) throw new Error("The newest release has no version.");
  const url = (name: string) => {
    const a = (Array.isArray(r.assets) ? r.assets : []).find((x) => x.name === name);
    return typeof a?.browser_download_url === "string" ? a.browser_download_url : null;
  };
  return { version, dmgUrl: url(DMG), zipUrl: url(ZIP), sha256: null };
}

/** The version of a GitHub release JSON: from the notes, "contr 0.1.<run> from <sha>.", else from the name. */
export function versionOf(json: unknown): string | null {
  const r = json as { body?: unknown; name?: unknown } | null;
  const text = `${typeof r?.body === "string" ? r.body : ""} ${typeof r?.name === "string" ? r.name : ""}`;
  return /contr (\d+\.\d+\.\d+)/.exec(text)?.[1] ?? null;
}

/** The message when no answer comes: fetch fails before any HTTP status. */
export const NO_NETWORK = "No network: GitHub cannot be reached.";

/**
 * The message of a failed answer. A 403 or 429 with `x-ratelimit-remaining: 0` is GitHub's limit; the time of
 * `x-ratelimit-reset` (seconds since 1970) is local, HH:MM. Else "HTTP <status>".
 */
export function failText(res: { status: number; headers: Headers }): string {
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    if (!reset) return "GitHub's limit for this network is reached. Try again later.";
    const at = new Date(reset * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `GitHub's limit for this network is reached. Try again after ${pad(at.getHours())}:${pad(at.getMinutes())}.`;
  }
  return `HTTP ${res.status}`;
}

/** GETs `url` (redirects followed). Throws NO_NETWORK when no answer comes. */
async function answer(url: string, get: typeof fetch, accept: string): Promise<Response> {
  try {
    return await get(url, { headers: { Accept: accept } });
  } catch {
    throw new Error(NO_NETWORK);
  }
}

/** GETs a GitHub API URL as JSON (no token). Throws failText or NO_NETWORK on a failed read. */
export async function getJson(url: string, get: typeof fetch = fetch): Promise<unknown> {
  const res = await answer(url, get, "application/vnd.github+json");
  if (!res.ok) throw new Error(failText(res));
  return res.json();
}

/** One read of release.json: the newest release and the change log of the newest releases, this one first. */
export interface ReleaseFile {
  release: Release;
  releases: ChangeLogRelease[];
}

/**
 * Reads release.json at `url`. Gives null when the file is not there (HTTP 404: a release from before #128) or
 * is not a schema 1 file: the caller then reads the API. Throws on any other failed read.
 */
export async function readReleaseFile(url: string, get: typeof fetch = fetch): Promise<ReleaseFile | null> {
  const res = await answer(url, get, "application/json");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(failText(res));
  try {
    return parseReleaseFile(await res.json(), url);
  } catch {
    return null;
  }
}

/**
 * Reads release.json (scripts/release-notes.mjs writes it). An asset's URL is releases/download/<tag>/<name>
 * next to the file's releases/latest/download/. Throws when the file is not schema 1.
 */
export function parseReleaseFile(json: unknown, url: string): ReleaseFile {
  const f = json as { schema?: unknown; version?: unknown; tag?: unknown; assets?: unknown; sha256?: unknown; releases?: unknown } | null;
  const text = (v: unknown) => typeof v === "string";
  if (f?.schema !== 1 || !text(f.version) || !/^\d+\.\d+\.\d+$/.test(f.version as string) || !text(f.tag) || !Array.isArray(f.assets) || !Array.isArray(f.releases)) throw new Error("Not a release file.");
  const tag = f.tag as string;
  const assets = f.assets as unknown[];
  const asset = (name: string) => (assets.includes(name) ? new URL(`../../download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`, url).href : null);
  type Raw = { version?: unknown; tag?: unknown; date?: unknown; changes?: unknown };
  const releases = (f.releases as Raw[])
    .filter((r) => r && text(r.version) && text(r.tag) && text(r.date) && Array.isArray(r.changes))
    .slice(0, CHANGELOG_COUNT)
    .map((r) => ({ version: r.version as string, tag: r.tag as string, date: r.date as string, changes: (r.changes as unknown[]).filter(text) as string[] }));
  const sha256 = typeof f.sha256 === "string" && /^[a-f0-9]{64}$/i.test(f.sha256) ? f.sha256.toLowerCase() : null;
  return { release: { version: f.version as string, dmgUrl: asset(DMG), zipUrl: asset(ZIP), sha256 }, releases };
}
