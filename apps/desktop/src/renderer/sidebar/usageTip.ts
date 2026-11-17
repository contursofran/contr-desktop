import type { UsageRow } from "../../shared/api";
import { duration } from "./ages";

/**
 * A usage row's tooltip, in the sidebar's age format: "Read 2h ago" ("Read just now"), and for a stale
 * row "No current data. Last read 2d ago." Without a read time, only what is known.
 */
export function usageTip(row: UsageRow, now: number): string | null {
  const ago = row.readAt === null ? null : duration(now - row.readAt);
  const read = ago === null ? null : ago === "<1m" ? "read just now" : `read ${ago} ago`;
  if (row.percent === null) return read === null ? "No current data." : `No current data. Last ${read}.`;
  return read === null ? null : read[0]!.toUpperCase() + read.slice(1);
}
