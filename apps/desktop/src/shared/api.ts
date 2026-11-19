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
  /** A tab's title for a terminal with no sidebar entry: hc `title`, else the program name, else "Terminal". Never the address. `gone`: hc runs and does not list the terminal. `error`: hc failed, so the tab stays. */
  tabTitle(terminal: string): Promise<TabTitle>;
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
  /** The `contr-digest` counts: gh (merges, failed checks) and the orchestration tool (workers, owner items). */
  digest(): Promise<Digest>;
  /** Model, effort, speed tier, context, output speed and menu choices from the helper. */
  replyInfo(): Promise<ReplyInfo>;
  /** Sets the speed tier of the active chat through the helper's `tier` command. */
  setTier(terminal: string, tier: SpeedTier): Promise<{ ok: boolean; message?: string }>;
  /** The branch in the agent's cwd (`git branch --show-current`). null: not known. */
  branch(): Promise<string | null>;
  /** The Projects list and the selected agent. */
  sidebar(): Promise<Sidebar>;
  /** Listens to changes of the Projects list. Returns a function that stops listening. */
  onSidebar(listener: (sidebar: Sidebar) => void): () => void;
  /** Makes this terminal's agent the chat's agent; "" shows none and stops the feed. Returns the selected terminal. */
  select(terminal: string): Promise<string>;
  /** The plan usage rows (helper `usage`), Claude then Codex. A plan with no data has no row. */
  usage(): Promise<UsageRow[]>;
  /** Listens to new plan usage (every 5 minutes). Returns a function that stops listening. */
  onUsage(listener: (rows: UsageRow[]) => void): () => void;
  /** hc's other machines (`hc machine ls --json`). */
  machines(): Promise<Machine[]>;
  /** The open owner questions and to-dos (`owner open --json`). */
  owner(): Promise<OwnerItems>;
  /** Listens to changes of the open owner items. Returns a function that stops listening. */
  onOwner(listener: (items: OwnerItems) => void): () => void;
  /** Why the last read of `owner open --json` failed, or null after a good read. The items stay as the last good read gave them. */
  ownerError(): Promise<string | null>;
  /** Listens to changes of `ownerError`. Returns a function that stops listening. */
  onOwnerError(listener: (error: string | null) => void): () => void;
  /** Answers an owner question (`owner answer <id> <answer>`). */
  ownerAnswer(id: string, answer: string): Promise<OwnerResult>;
  /** Marks an owner to-do done (`owner done <id>`). */
  ownerDone(id: string): Promise<OwnerResult>;
  /** The Settings view's data. */
  settings(): Promise<Settings>;
  /** Saves the theme choice and shows it at once. */
  setTheme(theme: ThemeChoice): Promise<ThemeChoice>;
  /** The update state now. */
  update(): Promise<UpdateState>;
  /** Calls the listener on each change of the update state. Returns the unsubscribe. */
  onUpdate(listener: (state: UpdateState) => void): () => void;
  /** Downloads the newest release: the .zip, unpacked and checked, else the .dmg into Downloads, opened. */
  downloadUpdate(): Promise<void>;
  /** Quits, swaps in the checked new app and opens it. */
  restartToUpdate(): Promise<void>;
  /** Reads the newest release now. A call while a check runs waits for that check. */
  checkUpdate(): Promise<void>;
  /**
   * The newest releases for Settings > Change log, as the last read gave them; while a read runs, its result.
   * `again` reads them now (Retry). Each update check reads them again.
   */
  changeLog(again?: boolean): Promise<ChangeLog>;
  /** The core's state now (Settings > Core). */
  core(): Promise<CoreState>;
  /** Calls the listener on each change of the core's state. Returns the unsubscribe. */
  onCore(listener: (state: CoreState) => void): () => void;
  /** Runs the helper's `update check` for the core's root; `force` asks GitHub again (Check now). A call while a check runs waits for it. */
  checkCore(force?: boolean): Promise<void>;
  updateCore(): Promise<void>;
  /** Calls the listener when the app menu's "Check for Updates…" asks to show Settings. Returns the unsubscribe. */
  onOpenSettings(listener: () => void): () => void;
  /** Subscribes to File > Close Tab when the renderer has a native menu. */
  onCloseTab?(listener: () => void): () => void;
  terminal: TerminalApi;
  /** The `contr-pr` card: one PR from gh (`gh pr view`) and its worker from the orchestration tool. null: gh gave no PR. */
  prCard(n: number): Promise<PrCard | null>;
}

/** The answer of `tabTitle`: the title, the terminal is gone (hc runs and does not list it), or hc failed. */
export type TabTitle = { title: string } | { gone: true } | { error: string };

/** An agent row. An orchestrator has workers (hc `parent`). `name` is the worker's name, else hc's name. */
export interface SidebarAgent {
  terminal: string;
  /** The agent's session folder, when available. */
  cwd?: string;
  title: string;
  name: string | null;
  state: WorkerState;
  /** The program's kind from hc `agent` ("claude-code", "codex"), null when hc gives none. */
  kind: string | null;
  /** The issue from the orchestration tool, null when unknown. */
  issue: string | null;
  workers: SidebarAgent[];
}

/** A project: the repository of its agents' folder. */
export interface SidebarProject {
  name: string;
  agents: SidebarAgent[];
  /** The folder of its first agent: git and the favicon look here. */
  cwd: string;
  /** The current branch; null on a detached HEAD or with no git. */
  branch: string | null;
  /** Commits ahead of and behind the upstream; 0 with no upstream. */
  ahead: number;
  behind: number;
  /** A `contr-image://local/...` URL of the project's favicon, else null (the folder icon shows). */
  favicon: string | null;
}

export interface Sidebar {
  projects: SidebarProject[];
  selected: string;
  /** The error text when `hc ls --json` failed (hc missing, not running, no JSON); absent when hc answered. */
  hcError?: string;
}

/**
 * A foot row: the plan, the most used current window's percent, and its text ("41% wk · 4d").
 * A stale plan (no current window) has `percent` null and the value "—".
 */
export interface UsageRow {
  plan: string;
  percent: number | null;
  value: string;
  /** When the helper read the plan's data (ms since the epoch), from `read_at`; null when not known. */
  readAt: number | null;
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
  /** Each worker's role from the orchestration tool (`builder-medium`, `planner`, `reviewer`); absent when it gives none. */
  roles: Record<string, string>;
  /** The chat's agent (its hc address): the coordinator of the board's owner items. */
  agent: string;
  checks: Record<number, PrChecks | null>;
  /** Live workers whose parent is the chat's agent (its hc address in CONTR_TERMINAL). */
  orchestrating: number;
}

/** "Since you left": counts from the owner's last message (`since`, ms) to now. A count that its source did not give is null. */
export interface Digest {
  since: number | null;
  /** PRs merged at or after `since` (gh). */
  merged: number | null;
  /** Live workers of the chat's agent that work now (the orchestration tool). */
  busy: number | null;
  /** Open owner questions and to-dos of the chat's agent (the orchestration tool). */
  waiting: number | null;
  /** Open PRs with a failed check on their head (gh). */
  failing: number | null;
}

/** The reply box's data. A part the helper does not know is null (or empty). */
export type SpeedTier = "standard" | "fast" | "ultrafast";
export type AcceleratedTier = Exclude<SpeedTier, "standard">;

export interface ReplyInfo {
  agent: string | null;
  model: string | null;
  effort: string | null;
  tier: string | null;
  tiers: AcceleratedTier[];
  speed: string | null;
  context: { percent: number; text: string; warn: boolean } | null;
  models: { value: string; label: string }[];
  efforts: { value: string; label: string }[];
}

/** The checks of a PR's head from gh: the rollup's state and the counts of all its checks. */
export interface CheckCounts {
  state: "pass" | "pending" | "fail";
  passed: number;
  failed: number;
  total: number;
}

/** A PR or an issue of the agent's repository, as gh says now. A PR with no checks has no `checks`. */
export type RefState =
  | { kind: "pr"; state: "open" | "draft" | "merged" | "closed"; url: string; checks?: CheckCounts }
  | { kind: "issue"; state: "open" | "closed" | "not-planned"; url: string };

export type TerminalKind = "claude" | "codex" | "shell";
export type TerminalStart = { terminal: string } | { error: string };

/** The Terminal side: the agent's hc terminal. */
export interface TerminalApi {
  /** False in hidden Electron tests, which read the DOM rows. */
  webgl?: boolean;
  /** Starts a terminal in hc, with no parent. null uses the home folder. */
  start?(kind: TerminalKind, cwd: string | null): Promise<TerminalStart>;
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
export const TAB_TITLE_CHANNEL = "contr:tab-title";
export const REFS_CHANNEL = "contr:refs";
export const OPEN_REF_CHANNEL = "contr:open-ref";
export const APPROVE_CHANNEL = "contr:approve";
export const ANSWER_CHANNEL = "contr:answer";
export const BOARD_CHANNEL = "contr:board";
export const DIGEST_CHANNEL = "contr:digest";
export const REPLY_INFO_CHANNEL = "contr:reply-info";
export const SET_TIER_CHANNEL = "contr:set-tier";
export const BRANCH_CHANNEL = "contr:branch";
export const SIDEBAR_CHANNEL = "contr:sidebar";
export const SIDEBAR_EVENT = "contr:sidebar-event";
export const SELECT_CHANNEL = "contr:select";
export const USAGE_CHANNEL = "contr:usage";
export const USAGE_EVENT = "contr:usage-event";
export const MACHINES_CHANNEL = "contr:machines";

export const OWNER_CHANNEL = "contr:owner";
export const OWNER_EVENT = "contr:owner-event";
export const OWNER_ANSWER_CHANNEL = "contr:owner-answer";
export const OWNER_DONE_CHANNEL = "contr:owner-done";
export const OWNER_ERROR_CHANNEL = "contr:owner-error";
export const OWNER_ERROR_EVENT = "contr:owner-error-event";

/** An open owner question from `herdr-contr-orch owner open --json`. Options have the recommended one first. */
export interface OwnerQuestion {
  id: string;
  /** The hc address of the coordinator that asked, with no `hc:` prefix. */
  coordinator: string;
  /** The place in `owner open --json` (oldest first), shared by questions and to-dos. */
  order: number;
  title: string;
  from: string;
  question: string;
  options: { label: string; impact: string; recommended: boolean }[];
  refs: string[];
}

/** An open owner to-do (`kind: "todo"`). */
export interface OwnerTodo {
  id: string;
  coordinator: string;
  order: number;
  from: string;
  text: string;
  know: boolean;
}

export interface OwnerItems {
  questions: OwnerQuestion[];
  todos: OwnerTodo[];
}

/** The result of `owner answer` or `owner done`. `ok` false: the run failed and nothing changed. `note`: why, or "saved, coordinator not reached". */
export interface OwnerResult {
  ok: boolean;
  note: string | null;
}

/** The theme choice in Settings. "system" follows macOS. */
export type ThemeChoice = "system" | "dark" | "light";

/** What the Settings view shows. */
export interface Settings {
  theme: ThemeChoice;
  /** The helper's path: CONTR_HELPER, else the core home's helper when the app runs it, else the bundled binary (Resources/bin when packaged, bin/ in dev). */
  helper: string;
}

export const SETTINGS_CHANNEL = "contr:settings";
export const THEME_CHANNEL = "contr:theme";

/** The Update section in Settings and the dot on the foot's Settings button. */
export interface UpdateState {
  /** This app's version (app.getVersion()). */
  current: string;
  /** True in dev and e2e with no fake release URL: nothing is checked. */
  dev: boolean;
  /** The newest release's version, once a check passed. */
  latest: string | null;
  /** The newest release is newer than this app and has the .zip (writable app folder) or the .dmg. */
  available: boolean;
  /** 0 to 100 while the .zip or .dmg downloads, else null. */
  progress: number | null;
  /** The downloaded .dmg's path, once it is opened; a passed check that takes a release clears it. */
  downloaded: string | null;
  /** The new app is unpacked and checked: Settings shows "Restart to update". */
  ready: boolean;
  /** The message of a failed check or download. */
  error: string | null;
  /** A check of the newest release runs now. */
  checking: boolean;
  /** The time (ms) of the last finished check, passed or failed; null before the first one. */
  checked: number | null;
  /** True after a failed check, until a check passes: Settings then shows the failure, not "Checked …". */
  checkFailed?: boolean;
}

export const UPDATE_CHANNEL = "contr:update";
export const UPDATE_EVENT = "contr:update-event";
export const UPDATE_DOWNLOAD_CHANNEL = "contr:update-download";
export const UPDATE_RESTART_CHANNEL = "contr:update-restart";
export const UPDATE_CHECK_CHANNEL = "contr:update-check";
export const CHANGELOG_CHANNEL = "contr:changelog";

/** Settings > Core and the dot on the foot's Settings button. The UpdateState fields mean the same for the core. */
export interface CoreState extends UpdateState {
  /** The root folder, or null when the core logic is off (dev, e2e with no CONTR_CORE_HOME). */
  root: string | null;
  /** The copy that the app runs now. */
  source: "home" | "bundle";
  /** The root is shared with the Herdr app and the owner did not say yes: the app changes nothing there. */
  shared: boolean;
  /** An update install runs now. */
  installing: boolean;
  /** The version of the last update done in this run, else null. */
  updated: string | null;
}

export const CORE_CHANNEL = "contr:core";
export const CORE_EVENT = "contr:core-event";
export const CORE_CHECK_CHANNEL = "contr:core-check";
export const CORE_UPDATE_CHANNEL = "contr:core-update";

/** One release in Settings > Change log. */
export interface ChangeLogRelease {
  /** From the notes' first line, "contr 0.1.24 from <sha>.", as the update check reads it. */
  version: string;
  tag: string;
  /** The day it was published, "2026-11-17" (UTC). */
  date: string;
  /** The lines of the notes' "## Changes" part, newest first; empty when the notes have no such part. */
  changes: string[];
}

/** Settings > Change log. `releases` is null when nothing was read: dev and e2e with no fake URL, or a first read that failed. */
export interface ChangeLog {
  releases: ChangeLogRelease[] | null;
  /** The message of the last failed read, else null. */
  error: string | null;
}
/** Main to renderer: show the Settings view (the app menu's "Check for Updates…"). */
export const OPEN_SETTINGS_EVENT = "contr:open-settings";
export const CLOSE_TAB_EVENT = "contr:close-tab";

/** One check of a PR's head (gh's rollup). Times are ms; a check that runs has no `completedAt`, a queued one no `startedAt`. */
export interface PrCheck {
  name: string;
  state: "pass" | "fail" | "running" | "queued" | "skipped";
  startedAt: number | null;
  completedAt: number | null;
}

/** The `contr-pr` card's data, as gh and the orchestration tool say now. */
export interface PrCard {
  number: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  url: string;
  additions: number;
  deletions: number;
  /** The head branch and the base branch. */
  branch: string;
  base: string;
  files: number;
  /** The head commit's full SHA. */
  head: string;
  checks: PrCheck[];
  /** The latest review: its author, gh's state (APPROVED, CHANGES_REQUESTED, COMMENTED) and the commit it reviewed. */
  review: { author: string; state: string; sha: string | null } | null;
  /** gh's mergeStateStatus (CLEAN, BLOCKED, BEHIND, DIRTY, UNSTABLE, DRAFT, UNKNOWN). */
  merge: string | null;
  /** The worker of the PR's branch. null: no worker has it. */
  worker: { name: string; state: WorkerState } | null;
}
export const PR_CARD_CHANNEL = "contr:pr-card";
