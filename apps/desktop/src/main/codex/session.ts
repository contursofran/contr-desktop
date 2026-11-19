import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CODEX_ORCHESTRATE_COMMAND, codexThreadId } from "../../shared/codex";
import type { Card, FeedEvent, FeedRow, PromptResult, SidebarAgent } from "../../shared/api";
import { CodexRpc, type Message } from "./rpc";
import { Coordinator } from "./coordinator";
import { openOrchestration } from "./orchestration";

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
const reportRoot = () => join(app.getPath("userData"), "codex-reports");

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
    if (existsSync(join(reportRoot(), threadId))) {
      void codexSession(tab).catch(() => undefined);
      continue;
    }
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
    for (const session of live.values()) {
      session.close();
      session.emit({ type: "error", code: "codex", message: error });
    }
    live.clear();
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
}

async function openSession(method: "thread/start" | "thread/resume", params: Record<string, string>) {
  const rpc = await connect();
  const tools = await openOrchestration().catch(() => undefined);
  try {
    const data = await rpc.request<ThreadResult>(method, { ...params, config: tools?.config });
    return new Session(rpc, data, tools);
  } catch (error) {
    tools?.close();
    throw error;
  }
}

export async function newCodexChat(cwd: string): Promise<string> {
  const session = await openSession("thread/start", { cwd });
  const tab = "codex:" + session.threadId;
  sessions.set(tab, Promise.resolve(session));
  return tab;
}

export function codexSession(tab: string): Promise<Session> {
  const known = sessions.get(tab);
  if (known) return known;
  const threadId = codexThreadId(tab);
  if (!threadId) return Promise.reject(new Error("Invalid Codex thread."));
  const loading = openSession("thread/resume", { threadId }).catch((error: unknown) => {
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
  private turnRevision = 0;
  private sending = false;
  private reports?: Coordinator;
  private attachingReports?: Promise<Coordinator>;
  private delivering = false;
  private reportsChanged = false;
  private closed = false;

  constructor(readonly rpc: CodexRpc, data: ThreadResult, private tools?: Awaited<ReturnType<typeof openOrchestration>>) {
    this.threadId = data.thread.id;
    this.thread = data.thread;
    this.model = data.model;
    for (const turn of data.thread.turns ?? []) for (const item of turn.items) this.item(item, true);
    this.updateAgent();
    live.set(this.threadId, this);
    if (codexThreadId("codex:" + this.threadId) && existsSync(join(reportRoot(), this.threadId))) {
      void this.followReports().catch((error: Error) => this.reportError(error));
    }
  }

  close() {
    this.closed = true;
    this.tools?.close();
    this.reports?.close();
  }

  private followReports() {
    return this.attachingReports ??= this.attachReports().catch((error: unknown) => {
      this.attachingReports = undefined;
      throw error;
    });
  }

  private async attachReports() {
    if (!codexThreadId("codex:" + this.threadId)) throw new Error("Invalid Codex thread.");
    const reports = new Coordinator(reportRoot(), this.threadId, this.thread.cwd);
    await reports.follow(() => {
      this.reportsChanged = true;
      void this.deliverReport();
    });
    if (this.closed) {
      reports.close();
      throw new Error("Codex disconnected.");
    }
    this.reports = reports;
    this.tools?.enable({
      cwd: this.thread.cwd,
      parent: async () => {
        const parent = await reports.parent();
        if (!parent) throw new Error("The hc coordinator has ended. Send /contr:orchestrate to start it again.");
        return parent;
      },
    });
    void this.deliverReport();
    return reports;
  }

  private reportError(error: Error) {
    this.row({ id: "contr:report-error", k: "assistant", text: "Could not deliver the worker report. " + error.message });
  }

  private async deliverReport() {
    if (this.closed || this.turn || this.sending || this.delivering || !this.reports || !this.reportsChanged) return;
    this.delivering = true;
    this.reportsChanged = false;
    try {
      const report = await this.reports.firstReport();
      if (report) {
        if (!this.closed && !this.turn && !this.sending) {
          await this.startTurn("Worker report via contr\n\n" + report.text);
          await report.delivered();
        }
        this.reportsChanged = true;
      }
    } catch (error) {
      if (!this.closed) this.reportError(error as Error);
      return;
    } finally {
      this.delivering = false;
    }
    void this.deliverReport();
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
    this.reportsChanged = true;
    void this.deliverReport();
    return () => { this.listeners.delete(listener); };
  }

  private async startTurn(text: string) {
    const revision = this.turnRevision;
    const { turn } = await this.rpc.request<{ turn: { id: string; status: string } }>("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text }],
    });
    // The reply can arrive before turn/started. A newer notification takes priority.
    if (this.turnRevision === revision && turn.status === "inProgress") {
      this.turn = turn.id;
      this.updateAgent();
      this.emit(this.working());
    }
  }

  async send(text: string) {
    if (this.sending || this.delivering || this.turn) return { ok: false, message: "Codex is working. Wait for this turn to finish." };
    this.sending = true;
    try {
      if (text.startsWith(CODEX_ORCHESTRATE_COMMAND)) {
        if (!this.tools) throw new Error("Could not load the contr orchestration tools.");
        const goal = text.slice(CODEX_ORCHESTRATE_COMMAND.length).trim();
        if (!goal) throw new Error("Enter a goal for the coordinator.");
        const reports = await this.followReports();
        await reports.parent(true);
        text = `${goal}

Coordinate this goal with contr_workers. Read the repository rules and call flow before you spawn workers. Give each worker its own worktree. Worker reports arrive in this chat.`;
      }
      await this.startTurn(text);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    } finally {
      this.sending = false;
      void this.deliverReport();
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
      this.turnRevision++;
      this.turn = method === "turn/started" ? turn.id : undefined;
      if (!this.turn) {
        if (turn.error?.message) this.row({ id: `error:${turn.id}`, k: "assistant", text: turn.error.message });
      }
      this.updateAgent();
      this.emit(this.working());
      if (!this.turn) {
        this.reportsChanged = true;
        void this.deliverReport();
      }
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
