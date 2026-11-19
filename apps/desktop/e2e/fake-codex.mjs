#!/usr/bin/env node
import { createInterface } from "node:readline";

const [, , command, mode] = process.argv;
if (command !== "app-server" || mode !== "--stdio") process.exit(1);

const emit = (message) => process.stdout.write(JSON.stringify(message) + "\n");
const notify = (method, params) => emit({ method, params: { threadId: "test-thread", ...params } });
const turn = { id: "test-turn", items: [] };
createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method, params, result } = JSON.parse(line);
  if (method === "initialize") emit({ id, result: {} });
  if (method === "thread/start") {
    emit({ id, result: { model: "gpt-test", thread: { id: "test-thread", cwd: params.cwd, turns: [] } } });
  }
  if (["thread/read", "thread/resume"].includes(method) && params.threadId === "test-thread") {
    const items = [{ id: "assistant", type: "agentMessage", text: "Codex finished." }];
    emit({ id, result: { model: "gpt-test", thread: { id: params.threadId, cwd: "/work/contr-desktop", name: "Workspace overview", preview: "Show the workspace", turns: [{ items }] } } });
  }
  if (method === "turn/start") {
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
    notify("thread/name/updated", { threadName: "Workspace overview" });
  }
});
