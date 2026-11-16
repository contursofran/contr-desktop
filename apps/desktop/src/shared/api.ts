// The typed bridge between main and renderer. Later steps add their calls here.

/** One conversation row from the helper (docs/reference/helper-protocol.md, `row`). */
export interface FeedRow {
  id: string;
  k: "user" | "assistant" | "tools" | "perm" | "question" | "status" | "sep" | "footer" | (string & {});
  text?: string;
  ts?: number;
  from?: string;
  images?: number;
  chips?: { symbol: string; text: string; calls: { name: string; summary: string; done: boolean; error: boolean; output?: string }[] }[];
  [field: string]: unknown;
}

/** What main sends after each helper call. */
export type FeedEvent =
  | { type: "splice"; at: number; rows: FeedRow[]; agent?: string; model?: string }
  | { type: "error"; code: string; message: string }
  | { type: "working"; working: Working };

/** The agent's working line (helper `working`). `text` is null when the agent does not work. */
export interface Working {
  text: string | null;
  detail: string | null;
}

export interface ContrApi {
  platform: string;
  /** Listens to the feed of the chat's agent. Returns a function that stops listening. */
  onFeed(listener: (event: FeedEvent) => void): () => void;
  /** Types a message into the agent's terminal and presses Enter. */
  send(text: string): Promise<{ ok: boolean; message?: string }>;
}

export const FEED_CHANNEL = "contr:feed";
export const FEED_READY_CHANNEL = "contr:feed-ready";
export const SEND_CHANNEL = "contr:send";
