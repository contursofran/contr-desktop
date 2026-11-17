import { newer } from "../../shared/version";

/** Settings > Change log shows this many releases open; the rest are behind "Show older". */
export const OPEN_COUNT = 3;

/** The mark of a release: "Installed" for this app's version, "New" for a newer one, else none. */
export function markOf(version: string, current: string | undefined): "Installed" | "New" | null {
  if (!current) return null;
  if (version === current) return "Installed";
  return newer(version, current) ? "New" : null;
}
