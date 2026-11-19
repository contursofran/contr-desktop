import { codexThreadId } from "../../shared/codex";
import type { Card, FeedEvent, FeedRow, PromptResult, SidebarAgent } from "../../shared/api";
import { CodexRpc, type Message } from "./rpc";

interface Item {
  id: string;
  type: string;
  text?: string;
  content?: { type: string; text?: string }[];
  command?: string;
  aggregatedOutput?: string;
  status?: string;
  tool?: string;
  query?: string;
  changes?: { path: string; diff?: string }[];
}
interface Thread {
  id: string;
  cwd: string;
  name?: string | null;
  preview?: string;
  turns?: { items: Item[] }[];
}
interface ThreadResult {
  thread: Thread;
  model: string;
}
const sessions = new Map<string, Promise<Session>>();
let connection: Promise<CodexRpc> | undefined;
const live = new Map<string, Session>();
const agents = new Map<string, SidebarAgent>();
let sidebarChanged = () => {};

export function onCodexSidebarChange(changed: () => void): void {
  sidebarChanged = changed;
}

export function codexAgents(): SidebarAgent[] {
  return [...agents.values()];
}

function updateAgent(thread: Thread, state: SidebarAgent["state"]) {
  const terminal = "codex:" + thread.id;
  const firstLine = (thread.name?.trim() || thread.preview?.trim() || "Codex").split(/\r?\n/, 1)[0]!;
  const title = firstLine.length > 80 ? firstLine.slice(0, 79).trimEnd() + "…" : firstLine;
  const old = agents.get(terminal);
  if (old?.title === title && old.cwd === thread.cwd && old.state === state) return;
  agents.set(terminal, { terminal, cwd: thread.cwd, title, state, name: null, kind: "codex", issue: null, workers: [] });
  sidebarChanged();
}

export function restoreCodexTabs(tabs: string[]): void {
  for (const tab of new Set(tabs)) {
    const threadId = codexThreadId(tab);
    if (!threadId || agents.has(tab)) continue;
    void connect().then((rpc) => rpc.request<{ thread: Thread }>("thread/read", { threadId }))
      .then(({ thread }) => {
        if (!agents.has(tab)) updateAgent(thread, "idle");
      }).catch(() => undefined);
  }
}

function connect() {
  return connection ??= CodexRpc.open((msg) => {
    const id = msg.params?.threadId;
    if (typeof id === "string") live.get(id)?.receive(msg);
  }, (error) => {
    connection = undefined;
    sessions.clear();
    for (const session of live.values()) session.emit({ type: "error", code: "codex", message: error });
    live.clear();
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
}

export async function newCodexChat(cwd: string): Promise<string> {
  const rpc = await connect();
  const data = await rpc.request<ThreadResult>("thread/start", { cwd });
  const session = new Session(rpc, data);
  const tab = "codex:" + data.thread.id;
  sessions.set(tab, Promise.resolve(session));
  return tab;
}

export function codexSession(tab: string): Promise<Session> {
  const known = sessions.get(tab);
  if (known) return known;
  const threadId = codexThreadId(tab);
  if (!threadId) return Promise.reject(new Error("Invalid Codex thread."));
  const loading = connect().then(async (rpc) =>
    new Session(rpc, await rpc.request<ThreadResult>("thread/resume", { threadId })),
  ).catch((error: unknown) => {
    sessions.delete(tab);
    throw error;
  });
  sessions.set(tab, loading);
  return loading;
}

export class Session {
  readonly threadId;
  private thread: Thread;
  readonly model;
  private rows: FeedRow[] = [];
  private indices = new Map<string, number>();
  private listeners = new Set<(event: FeedEvent) => void>();
  private approvals = new Map<string, { id: string | number; card: Card }>();
  private turn?: string;
  private sending = false;

  constructor(readonly rpc: CodexRpc, data: ThreadResult) {
    this.threadId = data.thread.id;
    this.thread = data.thread;
    this.model = data.model;
    for (const turn of data.thread.turns ?? []) for (const item of turn.items) this.item(item, true);
    this.updateAgent();
    live.set(this.threadId, this);
  }

  private updateAgent() {
    updateAgent(this.thread, this.approvals.size > 0 ? "blocked" : this.turn ? "working" : "idle");
  }

  emit(event: FeedEvent) {
    for (const listener of this.listeners) listener(event);
  }

  follow(listener: (event: FeedEvent) => void) {
    this.listeners.add(listener);
    listener({ type: "splice", at: 0, rows: this.rows, agent: "codex", model: this.model });
    listener(this.working());
    listener(this.card());
    return () => { this.listeners.delete(listener); };
  }

  async send(text: string) {
    if (this.sending || this.turn) return { ok: false, message: "Codex is working. Wait for this turn to finish." };
    this.sending = true;
    try {
      await this.rpc.request("turn/start", { threadId: this.threadId, input: [{ type: "text", text }] });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    } finally {
      this.sending = false;
    }
  }

  approve(request: string, allow: boolean): PromptResult {
    const approval = this.approvals.get(request);
    if (!approval) return { result: "changed" };
    this.rpc.write({ id: approval.id, result: { decision: allow ? "accept" : "decline" } });
    this.approvals.delete(request);
    this.updateAgent();
    this.emit(this.card());
    return { result: "sent" };
  }

  private working(): FeedEvent {
    return { type: "working", working: { text: this.turn ? "Working" : null, detail: null } };
  }

  private card(): FeedEvent {
    return { type: "card", card: this.approvals.values().next().value?.card ?? null };
  }

  private row(row: FeedRow) {
    const i = this.indices.get(row.id) ?? this.rows.length;
    this.indices.set(row.id, i);
    this.rows[i] = row;
    this.emit({ type: "splice", at: i, rows: this.rows.slice(i) });
  }

  private item(item: Item, done: boolean) {
    if (item.type === "userMessage" || item.type === "agentMessage") {
      const text = item.text ?? item.content?.map((part) => part.text ?? "").join("\n");
      if (text) {
        if (item.type === "userMessage" && !this.thread.preview?.trim()) {
          this.thread.preview = text;
          this.updateAgent();
        }
        this.row({ id: item.id, k: item.type === "userMessage" ? "user" : "assistant", text });
      }
      return;
    }
    const summary = item.command ?? item.changes?.map((change) => change.path).join(", ") ?? item.tool ?? item.query;
    if (!summary) return;
    const symbol = item.type === "fileChange" ? "pencil" : "terminal";
    const output = item.aggregatedOutput ?? item.changes?.map((change) => change.diff ?? "").join("\n");
    this.row({ id: item.id, k: "tools", chips: [{
      symbol, text: summary, calls: [{ name: item.type, summary, done, error: item.status === "failed", output }],
    }] });
  }

  receive({ id, method, params = {} }: Message) {
    if (method === "thread/name/updated") {
      this.thread.name = typeof params.threadName === "string" ? params.threadName : null;
      this.updateAgent();
    } else if (method === "turn/started" || method === "turn/completed") {
      const turn = params.turn as { id: string; status: string; error?: { message: string } };
      this.turn = method === "turn/started" ? turn.id : undefined;
      if (!this.turn) {
        if (turn.error?.message) this.row({ id: `error:${turn.id}`, k: "assistant", text: turn.error.message });
      }
      this.updateAgent();
      this.emit(this.working());
    } else if (method === "item/started" || method === "item/completed") {
      this.item(params.item as Item, method === "item/completed");
    } else if (method === "item/agentMessage/delta" && typeof params.itemId === "string" && typeof params.delta === "string") {
      const i = this.indices.get(params.itemId);
      const text = i === undefined ? "" : this.rows[i]?.text ?? "";
      this.row({ id: params.itemId, k: "assistant", text: text + params.delta });
    } else if (method === "serverRequest/resolved") {
      this.approvals.delete(String(params.requestId));
      this.updateAgent();
      this.emit(this.card());
    } else if (id !== undefined && (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval")) {
      const rowIndex = typeof params.itemId === "string" ? this.indices.get(params.itemId) : undefined;
      const summary = rowIndex === undefined ? undefined : this.rows[rowIndex]?.chips?.[0]?.text;
      const network = params.networkApprovalContext as { host: string; protocol: string } | undefined;
      const title = network ? "Network access" : method.includes("fileChange") ? "File changes" : "Run a command";
      const command = network ? `${network.protocol} ${network.host}` : typeof params.command === "string" ? params.command : summary ?? "";
      if (!command) {
        this.rpc.write({ id, result: { decision: "decline" } });
        return;
      }
      const request = String(id);
      this.approvals.set(request, { id, card: { kind: "approval", request, command, title, tool: title, answered: false } });
      this.updateAgent();
      this.emit(this.card());
    } else if (id !== undefined) {
      this.rpc.write({ id, error: { code: -32601, message: "This request is unavailable in contr Chat." } });
    }
  }
}
