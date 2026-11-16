#!/usr/bin/env node
import { readFileSync } from "node:fs";
// A fake hc for tests. `get --json <terminal>` gives FAKE_HC_TITLE (else the terminal's title below), its `agent` and FAKE_HC_CWD.
// `machine ls --json` gives two machines when FAKE_HC_AGENTS=1, else none.
// `ls --json` lists (with hc's `agent` kind) the agents below when FAKE_HC_AGENTS=1, else none. `events` ends at once: the app polls.
const agents = [
  { address: "t7", name: "orch-contr-desktop", cwd: "/work/contr-desktop", status: "working", agent: "claude-code", title: "Chat panel usability audit" },
  { address: "t8", cwd: "/work/contr-desktop-wt/agent/30", parent: "t7", status: "working", agent: "claude-code" },
  { address: "t9", cwd: "/work/contr-desktop-wt/agent/40", parent: "t7", status: "done", agent: "claude-code" },
  { address: "t10", cwd: "/work/contr-desktop-wt/agent/50", parent: "t7", status: "done" },
  { address: "t11", name: "notes", cwd: "/work/contr-desktop", status: "done", agent: "claude-code", title: "Release notes draft" },
  { address: "t12", cwd: "/work/herdr-contr", status: "working", agent: "codex", title: "Install health check" },
  { address: "t13", name: "term-1", cwd: "/work/herdr-contr" },
].map((t) => ({ ...t, state: "live" }));
const [cmd, , terminal] = process.argv.slice(2);
if (cmd === "get") {
  // FAKE_HC_GONE: a comma list of addresses hc does not list; `get` fails for them.
  if ((process.env.FAKE_HC_GONE ?? "").split(",").includes(terminal)) process.exit(1);
  const found = agents.find((t) => t.address === terminal);
  const title = process.env.FAKE_HC_TITLE ?? found?.title ?? "";
  process.stdout.write(`${JSON.stringify({ address: terminal, name: "w-7", title, agent: found?.agent, cwd: process.env.FAKE_HC_CWD ?? "" })}\n`);
} else if (cmd === "machine") {
  const machines = [
    { name: "aerum-pc", state: "connected" },
    { name: "vps", state: "unreachable", why: "no answer" },
    { name: "tmp-1", state: "connected", temporary: true },
  ];
  process.stdout.write(JSON.stringify({ machines: process.env.FAKE_HC_AGENTS === "1" ? machines : [] }));
} else if (cmd === "ls") {
  // FAKE_HC_STATUS: a JSON file { address: status } that a test rewrites to change an agent's status.
  const status = process.env.FAKE_HC_STATUS ? JSON.parse(readFileSync(process.env.FAKE_HC_STATUS, "utf8")) : {};
  const list = process.env.FAKE_HC_AGENTS === "1" ? agents.map((t) => ({ ...t, status: status[t.address] ?? t.status, title: undefined })) : [];
  process.stdout.write(JSON.stringify({ terminals: list }));
} else process.exit(1);
