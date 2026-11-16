import type { FeedEvent, FeedRow, Working } from "../../shared/api";

export interface FeedState {
  rows: FeedRow[];
  error: { code: string; message: string } | null;
  agent?: string;
  model?: string;
  working: Working | null;
}

export const emptyFeed: FeedState = { rows: [], error: null, working: null };

/** Applies one helper answer: a splice drops the rows from `at` on and appends the new ones. */
export function applyFeed(state: FeedState, event: FeedEvent): FeedState {
  if (event.type === "working") return { ...state, working: event.working };
  if (event.type === "error") return { ...state, error: { code: event.code, message: event.message } };
  const at = Math.max(0, Math.min(event.at, state.rows.length));
  return {
    rows: [...state.rows.slice(0, at), ...event.rows],
    error: null,
    working: state.working,
    agent: event.agent ?? state.agent,
    model: event.model ?? state.model,
  };
}
