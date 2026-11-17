export { newer } from "../../shared/version";

/** The releases of contr-desktop. The repository is public: the API needs no token. */
const REPO_API = "https://api.github.com/repos/contursofran/contr-desktop";
/** The newest release. */
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
  return { version, dmgUrl: url(DMG), zipUrl: url(ZIP) };
}

/** The version of a GitHub release JSON: from the notes, "contr 0.1.<run> from <sha>.", else from the name. */
export function versionOf(json: unknown): string | null {
  const r = json as { body?: unknown; name?: unknown } | null;
  const text = `${typeof r?.body === "string" ? r.body : ""} ${typeof r?.name === "string" ? r.name : ""}`;
  return /contr (\d+\.\d+\.\d+)/.exec(text)?.[1] ?? null;
}

/** GETs a GitHub API URL as JSON (no token). Throws "HTTP <status>" on a failed answer. */
export async function getJson(url: string, get: typeof fetch = fetch): Promise<unknown> {
  const res = await get(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
