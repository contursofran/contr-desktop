import { useEffect, useSyncExternalStore } from "react";
import type { RefState } from "../../../shared/api";

/** Known states. A number that is not here yet, or is null, shows as plain text. */
const states = new Map<number, RefState | null>();
const listeners = new Set<() => void>();
const wanted = new Set<number>();
let pending: Set<number> | null = null;

/** Asks main for many numbers in one call; main's cache allows one gh call per number per minute. */
function request(n: number): void {
  wanted.add(n);
  if (pending) return void pending.add(n);
  pending = new Set([n]);
  queueMicrotask(() => {
    const numbers = [...pending!];
    pending = null;
    void window.contr.refs(numbers).then((result) => {
      for (const n of numbers) states.set(n, result[n] ?? null);
      listeners.forEach((l) => l());
    });
  });
}

// Refreshes shown numbers every 60 s (the gh cache's age): GitHub sends no event to the app.
setInterval(() => wanted.forEach(request), 60_000);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRefState(n: number): RefState | null | undefined {
  useEffect(() => {
    if (!states.has(n)) request(n);
  }, [n]);
  return useSyncExternalStore(subscribe, () => states.get(n), () => undefined);
}
