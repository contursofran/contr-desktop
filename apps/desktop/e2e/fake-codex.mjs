#!/usr/bin/env node
import { createInterface } from "node:readline";
import { appendFileSync, readFileSync } from "node:fs";

const [, , command, mode] = process.argv;
if (command !== "app-server" || mode !== "--stdio") process.exit(1);

const emit = (message) => process.stdout.write(JSON.stringify(message) + "\n");
const notify = (method, params) => emit({ method, params: { threadId: "test-thread", ...params } });
let turn = { id: "test-turn", items: [] };
let url;
let turning = 0;
const optionsLog = process.env.FAKE_CODEX_OPTIONS_LOG;
const defaults = optionsLog ? {
  model: "gpt-test", modelProvider: "test", reasoningEffort: "high", serviceTier: "priority", activePermissionProfile: { id: ":workspace" },
} : { model: "gpt-test" };
async function call(method, params = {}) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return (await response.json()).result;
}
async function orchestrate() {
  await call("initialize", { protocolVersion: "2025-06-18" });
  const { tools } = await call("tools/list");
  if (tools.map((tool) => tool.name).join() !== "flow,spawn,message") throw new Error("Unexpected tools");
  const flow = await call("tools/call", { name: "flow" });
  if (!flow.content[0].text.includes("Fixture flow: plan first.")) throw new Error("Missing flow");
  const reply = await call("tools/call", { name: "spawn", arguments: { name: "code-review", title: "Code review", profile: "codex", task: "Return a fixture report." } });
  if (reply.isError) throw new Error(reply.content[0].text);
  const other = await call("tools/call", { name: "message", arguments: { name: "t7", text: "Do not deliver." } });
  if (!other.isError) throw new Error("A coordinator can message another terminal");
}
createInterface({ input: process.stdin }).on("line", async (line) => {
  const { id, method, params, result } = JSON.parse(line);
  if (method === "initialize") emit({ id, result: {} });
  if (optionsLog && ["thread/start", "turn/start", "model/list", "permissionProfile/list"].includes(method)) {
    appendFileSync(optionsLog, JSON.stringify({ method, params }) + "\n");
  }
  if (method === "model/list") {
    const data = !optionsLog ? [] : params.cursor ? [{
      model: "gpt-test-next", displayName: "GPT Next", defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "medium" }], serviceTiers: [{ id: "ultrafast" }],
    }] : [{
      model: "gpt-test", displayName: "GPT Test", defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [{ reasoningEffort: "medium" }, { reasoningEffort: "high" }], serviceTiers: [{ id: "priority" }],
    }];
    emit({ id, result: { data, nextCursor: optionsLog && !params.cursor ? "next" : null } });
  }
  if (method === "permissionProfile/list") {
    const data = optionsLog ? [
      { id: ":read-only", allowed: true }, { id: ":workspace", allowed: true }, { id: ":danger-full-access", allowed: false },
    ] : [];
    emit({ id, result: { data, nextCursor: null } });
  }
  if (method === "thread/start") {
    url = params.config?.mcp_servers?.contr_workers?.url;
    emit({ id, result: { ...defaults, thread: { id: "test-thread", cwd: params.cwd, turns: [] } } });
  }
  if (["thread/read", "thread/resume"].includes(method) && params.threadId === "test-thread") {
    const items = [{ id: "assistant", type: "agentMessage", text: "Codex finished." }];
    const orchestration = process.env.FAKE_CODEX_ORCHESTRATION;
    const cwd = orchestration ? JSON.parse(readFileSync(process.env.FAKE_HC_LIST, "utf8")).terminals[0].cwd : "/work/contr-desktop";
    const name = orchestration ? "Release coordinator" : "Workspace overview";
    if (method === "thread/resume") url = params.config?.mcp_servers?.contr_workers?.url;
    emit({ id, result: { ...defaults, thread: { id: params.threadId, cwd, name, preview: "Show the workspace", turns: [{ items }] } } });
  }
  if (method === "turn/start") {
    const text = params.input[0].text;
    if (optionsLog) {
      turn = { id: "test-turn-" + ++turning, items: [] };
      emit({ id, result: { turn: { ...turn, status: "inProgress" } } });
      notify("turn/started", { turn });
      notify("item/completed", { item: { id: "user-" + turning, type: "userMessage", content: params.input } });
      notify("item/completed", { item: { id: "assistant-" + turning, type: "agentMessage", text: "Turn " + turning + " completed." } });
      notify("turn/completed", { turn: { ...turn, status: "completed" } });
      return;
    }
    if (process.env.FAKE_CODEX_ORCHESTRATION) {
      turn = { id: "test-turn-" + ++turning, items: [] };
      emit({ id, result: { turn } });
      notify("turn/started", { turn });
      notify("item/completed", { item: { id: "user-" + turning, type: "userMessage", content: params.input } });
      if (text.startsWith("Worker report via contr")) {
        notify("item/completed", { item: { id: "report-reply", type: "agentMessage", text: "Coordinator received the worker report." } });
        notify("turn/completed", { turn: { ...turn, status: "completed" } });
      } else if (text.includes("Coordinate this goal with contr_workers.")) {
        await orchestrate();
        emit({ id: "approval", method: "item/commandExecution/requestApproval", params: { threadId: "test-thread", command: "pwd" } });
      } else {
        notify("item/completed", { item: { id: "first-reply", type: "agentMessage", text: "Ready to coordinate." } });
        notify("turn/completed", { turn: { ...turn, status: "completed" } });
      }
      return;
    }
    emit({ id, result: { turn } });
    notify("turn/started", { turn });
    notify("item/completed", { item: { id: "user", type: "userMessage", content: params.input } });
    notify("item/agentMessage/delta", { itemId: "assistant", delta: "Streaming from Codex." });
    notify("item/started", { item: { id: "tool", type: "commandExecution", command: "pwd" } });
    emit({ id: "approval", method: "item/commandExecution/requestApproval", params: { threadId: "test-thread", command: "pwd" } });
  }
  if (id === "approval" && result?.decision === "accept") {
    notify("serverRequest/resolved", { requestId: id });
    notify("item/completed", { item: { id: "tool", type: "commandExecution", command: "pwd", status: "completed" } });
    notify("item/completed", { item: { id: "assistant", type: "agentMessage", text: "Codex finished." } });
    notify("turn/completed", { turn: { ...turn, status: "completed" } });
    notify("thread/name/updated", { threadName: process.env.FAKE_CODEX_ORCHESTRATION ? "Release coordinator" : "Workspace overview" });
  }
});
