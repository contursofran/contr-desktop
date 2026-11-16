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
  /** The title of the chat's terminal (hc `title`, else its name, else its address). */
  title(): Promise<string>;
  /** Saves the clipboard's image as a PNG with the helper's `paste-image`. `path` is null when there is no image. */
  pasteImage(): Promise<{ ok: boolean; path?: string | null; message?: string }>;
  /** PR and issue states of the agent's repository, from gh. null: gh does not know the number. */
  refs(numbers: number[]): Promise<Record<number, RefState | null>>;
  /** Opens a PR or issue in the browser. */
  openRef(url: string): Promise<void>;
  /** Model, effort, context and the menu's choices, from the helper (`model`, `status`, `commands`). */
  replyInfo(): Promise<ReplyInfo>;
  /** The branch in the agent's cwd (`git branch --show-current`). null: not known. */
  branch(): Promise<string | null>;
  terminal: TerminalApi;
}

/** The reply box's data. A part the helper does not know is null (or empty). */
export interface ReplyInfo {
  agent: string | null;
  model: string | null;
  effort: string | null;
  context: { percent: number; text: string; warn: boolean } | null;
  models: { value: string; label: string }[];
  efforts: { value: string; label: string }[];
}

/** A PR or an issue of the agent's repository, as gh says now. */
export type RefState =
  | { kind: "pr"; state: "open" | "draft" | "merged" | "closed"; url: string }
  | { kind: "issue"; state: "open" | "closed" | "not-planned"; url: string };

/** The Terminal side: the agent's hc terminal. */
export interface TerminalApi {
  /** Attaches at this size. Returns the terminal, or an error to show. */
  attach(cols: number, rows: number): Promise<{ terminal?: string; error?: string }>;
  /** Keys and paste, as the terminal's bytes. */
  input(text: string): void;
  resize(cols: number, rows: number): void;
  /** Listens to the terminal's bytes. Returns a function that stops listening. */
  onData(listener: (bytes: Uint8Array) => void): () => void;
  /** Listens for the end of the stream. Returns a function that stops listening. */
  onEnd(listener: (reason: string) => void): () => void;
}

export const FEED_CHANNEL = "contr:feed";
export const FEED_READY_CHANNEL = "contr:feed-ready";
export const SEND_CHANNEL = "contr:send";
export const PASTE_IMAGE_CHANNEL = "contr:paste-image";
export const TITLE_CHANNEL = "contr:title";
export const REFS_CHANNEL = "contr:refs";
export const OPEN_REF_CHANNEL = "contr:open-ref";
export const REPLY_INFO_CHANNEL = "contr:reply-info";
export const BRANCH_CHANNEL = "contr:branch";
