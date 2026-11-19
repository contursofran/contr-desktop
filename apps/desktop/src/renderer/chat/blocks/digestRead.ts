import { createContext, useEffect, useState } from "react";
import type { Digest, FeedRow } from "../../../shared/api";

export interface DigestRead {
  digest: Digest;
  at: number;
}

export interface DigestRange {
  since: number | null;
  end: number | null;
}

export const DigestRow = createContext<string | undefined>(undefined);
export const ChatDigests = createContext<{
  ranges: Map<string, DigestRange>;
  reads: Map<string, DigestRead>;
} | null>(null);

export const digestKey = (rowId: string, offset: number) => JSON.stringify([rowId, offset]);

/** The question is the last owner message before the answer. The message before it starts the span. */
export function digestRanges(rows: FeedRow[], lastOffset: (text: string) => number | undefined) {
  const ranges = new Map<string, DigestRange>();
  let lastKey: string | undefined;
  let previous: number | null = null;
  let latest: number | null = null;
  for (const row of rows) {
    if (row.k === "user" && typeof row.ts === "number") {
      previous = latest;
      latest = row.ts;
    }
    if (row.k !== "assistant" || !row.text) continue;
    const offset = lastOffset(row.text);
    if (offset === undefined) continue;
    ranges.set(row.id, { since: previous ?? latest, end: row.ts ?? null });
    lastKey = digestKey(row.id, offset);
  }
  return { lastKey, ranges };
}

/** gh and the orchestration tool send no event. Only the last digest in the chat asks every 30 s. */
export const DIGEST_POLL_MS = 30_000;

export function useDigestReads(lastKey: string | undefined, saved: Map<string, DigestRead> | undefined, onSave: (id: string, read: DigestRead) => void) {
  const [reads, setReads] = useState(() => new Map(saved));
  useEffect(() => {
    if (lastKey === undefined) return;
    let active = true;
    const ask = () => void window.contr.digest().then((digest) => {
      if (!active) return;
      const read = { digest, at: Date.now() };
      onSave(lastKey, read);
      setReads((previous) => new Map(previous).set(lastKey, read));
    }, () => undefined);
    ask();
    const interval = setInterval(ask, DIGEST_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lastKey, onSave]);
  return reads;
}
