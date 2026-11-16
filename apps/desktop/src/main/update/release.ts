/** The newest release of contr-desktop. The repository is public: the API needs no token. */
export const RELEASE_URL = "https://api.github.com/repos/contursofran/contr-desktop/releases/latest";
/** The .dmg's name does not change between releases (docs/reference/releases.md). */
export const DMG = "contr-mac-universal.dmg";

export interface Release {
  version: string;
  dmgUrl: string | null;
}

/**
 * Reads a GitHub release JSON. The tag is build-<date>-<sha7>, so the version comes from the notes,
 * "contr 0.1.<run> from <sha>." (release.yml), else from the name. Throws when no version is found.
 */
export function parseRelease(json: unknown): Release {
  const r = json as { body?: unknown; name?: unknown; assets?: { name?: unknown; browser_download_url?: unknown }[] };
  const text = `${typeof r?.body === "string" ? r.body : ""} ${typeof r?.name === "string" ? r.name : ""}`;
  const version = /contr (\d+\.\d+\.\d+)/.exec(text)?.[1];
  if (!version) throw new Error("The newest release has no version.");
  const dmg = (Array.isArray(r.assets) ? r.assets : []).find((a) => a.name === DMG);
  return { version, dmgUrl: typeof dmg?.browser_download_url === "string" ? dmg.browser_download_url : null };
}

/** True when version a is newer than b (each "x.y.z"). */
export function newer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}
