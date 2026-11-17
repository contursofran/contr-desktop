import type { UpdateState } from "../../shared/api";
import { checkedText } from "./checked";

/** What the Updates section shows for one update state. Each text is null when it does not show. */
export interface UpdateView {
  /** The value of the "Newest" row. */
  newest: string;
  /** The Check now button; null in dev. */
  check: { label: "Check now" | "Checking…"; disabled: boolean } | null;
  /** The button next to the newest version: Update (or its progress), or Restart to update. */
  action: { kind: "update"; label: string; disabled: boolean } | { kind: "restart"; label: "Restart to update" } | null;
  /** "Checked 5m ago", only after a passed check and not while a check runs. */
  lastCheck: string | null;
  /** 0 to 100 while a download runs. */
  progress: number | null;
  /** The line after a .dmg is opened: its file name, not its path. */
  status: string | null;
  /** The failed check's or download's message; a new check hides an old check's failure while it runs. */
  error: string | null;
}

/**
 * The texts and buttons of Settings > Updates for `u` at the time `now`: one true thing at a time.
 * A failed check shows its message in place of "Checked …", and "Up to date" only follows a passed check.
 */
export function updateView(u: UpdateState | undefined, now: number): UpdateView {
  if (!u) return { newest: "Checking…", check: null, action: null, lastCheck: null, progress: null, status: null, error: null };
  const failed = u.checkFailed === true;
  const upToDate = !failed && u.latest != null && u.latest === u.current && !u.available && !u.ready;
  const newest = u.dev ? "Development build" : upToDate ? "Up to date" : (u.latest ?? (failed && !u.checking ? "Unknown" : "Checking…"));
  const action: UpdateView["action"] = u.ready
    ? { kind: "restart", label: "Restart to update" }
    : u.available
      ? { kind: "update", label: u.progress !== null ? `Downloading ${u.progress}%` : "Update", disabled: u.progress !== null }
      : null;
  return {
    newest,
    check: u.dev ? null : { label: u.checking ? "Checking…" : "Check now", disabled: u.checking },
    action,
    lastCheck: u.checked != null && !u.checking && !failed ? checkedText(u.checked, Math.max(now, u.checked)) : null,
    progress: u.progress,
    status: u.downloaded ? `Opened ${u.downloaded.split(/[\\/]/).pop()}. Drag contr to Applications.` : null,
    error: failed && u.checking ? null : u.error,
  };
}
