import { duration } from "../sidebar/ages";

/** "Checked just now", "Checked 5m ago": the time of the last update check, in the sidebar's age format. */
export function checkedText(checked: number, now: number): string {
  const ago = duration(now - checked);
  return ago === "<1m" ? "Checked just now" : `Checked ${ago} ago`;
}
