import type { UpdateState } from "../../shared/api";

/** Runs one `run` at a time: a call while one runs gets that run's promise. */
export function singleFlight(run: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => (running ??= run().finally(() => (running = null)));
}

/**
 * The state change after a passed check of the newest release (`version`, `installable`: it has a .zip or a .dmg).
 * `take` is false while a download runs or a new app is ready: the check then keeps that release, its progress,
 * `ready`, `downloaded` and the unpacked app. A release newer than the ready one does not replace it: the
 * owner restarts into the ready one, and the new app's first check then shows the newer one.
 */
export function afterCheck(state: UpdateState, version: string, installable: boolean, isNewer: boolean, now: number): { take: boolean; change: Partial<UpdateState> } {
  const done = { checking: false, checked: now, error: null };
  if (state.progress !== null || state.ready) return { take: false, change: done };
  return { take: true, change: { ...done, latest: version, available: installable && isNewer } };
}
