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
  | { type: "working"; working: Working }
  | { type: "card"; card: Card | null };

/** The prompt on the agent's screen (helper `card`). */
export type Card =
  | { kind: "approval"; request: string; title: string; command: string; tool: string; answered: boolean }
  | { kind: "question"; request: string; question: QuestionCard; unread: number };

export interface QuestionCard {
  agent: string;
  delivery: "picker" | "message";
  questions: { id: string; header: string; text: string; multi: boolean; options: { label: string; detail?: string; recommended?: boolean }[] }[];
  noOther?: boolean;
}

/** The helper's `done` result of `approve` or `answer`: sent, changed, unconfirmed, answered, busy, failed, … */
export interface PromptResult {
  result: string;
  message?: string;
}

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
  /** Opens the native file picker for an image (png, jpeg, gif, webp). `path` is null when the owner cancels. */
  pickImage(): Promise<{ ok: boolean; path?: string | null; message?: string }>;
  /** PR and issue states of the agent's repository, from gh. null: gh does not know the number. */
  refs(numbers: number[]): Promise<Record<number, RefState | null>>;
  /** Opens a PR or issue in the browser. */
  openRef(url: string): Promise<void>;
  /** Allows (true) or denies an approval card through the helper's `approve`. */
  approve(request: string, allow: boolean): Promise<PromptResult>;
  /** Answers a question card through the helper's `answer`: one entry per question. */
  answer(request: string, answers: { picks: number[]; other?: string }[]): Promise<PromptResult>;
  /** The `contr-status` board: worker states from the orchestration tool, and each issue's PR checks from gh. */
  board(issues: number[]): Promise<Board>;
  /** Model, effort, context and the menu's choices, from the helper (`model`, `status`, `commands`). */
  replyInfo(): Promise<ReplyInfo>;
  /** The branch in the agent's cwd (`git branch --show-current`). null: not known. */
  branch(): Promise<string | null>;
  /** The Projects list and the selected agent. */
  sidebar(): Promise<Sidebar>;
  /** Listens to changes of the Projects list. Returns a function that stops listening. */
  onSidebar(listener: (sidebar: Sidebar) => void): () => void;
  /** Makes this terminal's agent the chat's agent. Returns the selected terminal. */
  select(terminal: string): Promise<string>;
  /** The plan usage rows (helper `usage`), Claude then Codex. A plan with no data has no row. */
  usage(): Promise<UsageRow[]>;
  /** Listens to new plan usage (every 5 minutes). Returns a function that stops listening. */
  onUsage(listener: (rows: UsageRow[]) => void): () => void;
  /** hc's other machines (`hc machine ls --json`). */
  machines(): Promise<Machine[]>;
  terminal: TerminalApi;
}

/** An agent row. An orchestrator has workers (hc `parent`). `name` is the worker's name, else hc's name. */
export interface SidebarAgent {
  terminal: string;
  title: string;
  name: string | null;
  state: WorkerState;
  workers: SidebarAgent[];
}

/** A project: the repository of its agents' folder. */
export interface SidebarProject {
  name: string;
  agents: SidebarAgent[];
}

export interface Sidebar {
  projects: SidebarProject[];
  selected: string;
}

/** A foot row: the plan, the most used window's percent, and its text ("41% wk · 4d"). */
export interface UsageRow {
  plan: string;
  percent: number;
  value: string;
}

/** A machine hc reaches over ssh. `state` is hc's ("connected", "unreachable", "needs-login", ...). */
export interface Machine {
  name: string;
  state: string;
}

/** A worker's mark: the loader, a check, a dot or an empty ring. */
export type WorkerState = "working" | "done" | "blocked" | "idle";

/** The PR that closes an issue, and its head's checks. null checks: the PR has none. */
export interface PrChecks {
  pr: number;
  checks: "pass" | "pending" | "fail" | null;
}

export interface Board {
  workers: Record<string, WorkerState>;
  checks: Record<number, PrChecks | null>;
  /** Live workers whose parent is the chat's agent (its hc address in CONTR_TERMINAL). */
  orchestrating: number;
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
export const PICK_IMAGE_CHANNEL = "contr:pick-image";
export const TITLE_CHANNEL = "contr:title";
export const REFS_CHANNEL = "contr:refs";
export const OPEN_REF_CHANNEL = "contr:open-ref";
export const APPROVE_CHANNEL = "contr:approve";
export const ANSWER_CHANNEL = "contr:answer";
export const BOARD_CHANNEL = "contr:board";
export const REPLY_INFO_CHANNEL = "contr:reply-info";
export const BRANCH_CHANNEL = "contr:branch";
export const SIDEBAR_CHANNEL = "contr:sidebar";
export const SIDEBAR_EVENT = "contr:sidebar-event";
export const SELECT_CHANNEL = "contr:select";
export const USAGE_CHANNEL = "contr:usage";
export const USAGE_EVENT = "contr:usage-event";
export const MACHINES_CHANNEL = "contr:machines";
