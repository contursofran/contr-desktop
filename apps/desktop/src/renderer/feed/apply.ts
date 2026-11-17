import type { Card, FeedEvent, FeedRow, Working } from "../../shared/api";

export interface FeedState {
  /** False until the helper's first answer: the chat shows that it reads. */
  loaded: boolean;
  rows: FeedRow[];
  error: { code: string; message: string } | null;
  agent?: string;
  model?: string;
  working: Working | null;
  card?: Card | null;
}

export const emptyFeed: FeedState = { loaded: false, rows: [], error: null, working: null };

/** Applies one helper answer: a splice drops the rows from `at` on and appends the new ones. */
export function applyFeed(state: FeedState, event: FeedEvent): FeedState {
  // Each tick of main ends with a `card` event, also when the feed is `unchanged` (an empty session).
  if (event.type === "working") return { ...state, loaded: true, working: event.working };
  if (event.type === "card") return { ...state, loaded: true, card: event.card };
  if (event.type === "error") return { ...state, loaded: true, error: { code: event.code, message: event.message } };
  const at = Math.max(0, Math.min(event.at, state.rows.length));
  return {
    loaded: true,
    rows: [...state.rows.slice(0, at), ...event.rows],
    error: null,
    working: state.working,
    card: state.card,
    agent: event.agent ?? state.agent,
    model: event.model ?? state.model,
  };
}
