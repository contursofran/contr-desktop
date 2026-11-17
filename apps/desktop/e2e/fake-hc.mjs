#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
// A fake hc for tests. `get --json <terminal>` gives FAKE_HC_TITLE (else the terminal's title below), its own name (else its address), its `agent` and FAKE_HC_CWD.
// `machine ls --json` gives two machines when FAKE_HC_AGENTS=1, else none.
// `ls --json` lists (with hc's `agent` kind) the agents below when FAKE_HC_AGENTS=1, else none. `events` ends at once: the app polls.
const agents = [
  { address: "t7", name: "orch-contr-desktop", cwd: "/work/contr-desktop", status: "working", agent: "claude-code", title: "Chat panel usability audit" },
  { address: "t8", name: "b-30", cwd: "/work/contr-desktop-wt/agent/30", parent: "t7", status: "working", agent: "claude-code" },
  { address: "t9", name: "b-40", cwd: "/work/contr-desktop-wt/agent/40", parent: "t7", status: "done", agent: "claude-code" },
  { address: "t10", name: "b-50", cwd: "/work/contr-desktop-wt/agent/50", parent: "t7", status: "done" },
  { address: "t11", name: "notes", cwd: "/work/contr-desktop", status: "done", agent: "claude-code", title: "Release notes draft" },
  { address: "t12", cwd: "/work/herdr-contr", status: "working", agent: "codex", title: "Install health check" },
  { address: "t13", name: "term-1", cwd: "/work/herdr-contr" },
].map((t) => ({ ...t, state: "live" }));
// FAKE_HC_LIST: a JSON file { terminals: [...] } used in place of the list above, for `ls` and `get`. `get` gives an entry
// as it is (with its `foreground`, whose `cwd` is the agent's session folder); `ls` gives it without `foreground` and `title`.
const listed = process.env.FAKE_HC_LIST ? JSON.parse(readFileSync(process.env.FAKE_HC_LIST, "utf8")).terminals : null;
const [cmd, , terminal] = process.argv.slice(2);
// FAKE_HC_DOWN: a file path. While the file is there, each command fails as an hc with no core does.
if (process.env.FAKE_HC_DOWN && existsSync(process.env.FAKE_HC_DOWN)) {
  process.stderr.write("fake hc: the core is not running\n");
  process.exit(1);
}
if (cmd === "connect" && process.env.FAKE_HC_CONNECT === "1") connect();
else if (cmd === "get") {
  // FAKE_HC_GONE: a comma list of addresses hc does not list; `get` fails for them.
  if ((process.env.FAKE_HC_GONE ?? "").split(",").includes(terminal)) process.exit(1);
  const found = (listed ?? agents).find((t) => t.address === terminal);
  if (listed) {
    process.stdout.write(`${JSON.stringify(found ?? { address: terminal })}\n`);
    process.exit(0);
  }
  const title = process.env.FAKE_HC_TITLE ?? found?.title ?? "";
  process.stdout.write(`${JSON.stringify({ address: terminal, name: found?.name ?? terminal, title, agent: found?.agent, cwd: process.env.FAKE_HC_CWD ?? "" })}\n`);
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
  const list = listed
    ? listed.map(({ foreground: _f, title: _t, ...t }) => t)
    : process.env.FAKE_HC_AGENTS === "1" ? agents.map((t) => ({ ...t, status: status[t.address] ?? t.status, title: undefined })) : [];
  process.stdout.write(JSON.stringify({ terminals: list }));
} else process.exit(1);

/**
 * FAKE_HC_CONNECT=1: `connect` answers as hc does (main/terminal/hc-attach.ts): the `hello` line, then framed JSON-RPC.
 * `terminal.attach` opens channel 1 and writes one line into it. The process ends when the app closes stdin.
 */
function connect() {
  const frame = (channel, payload) => {
    const head = Buffer.alloc(9);
    head.writeUInt32LE(channel, 0);
    head.writeUInt32LE(payload.length, 5);
    return Buffer.concat([head, payload]);
  };
  let buf = Buffer.alloc(0);
  let framed = false;
  process.stdin.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    if (!framed) {
      const nl = buf.indexOf(10);
      if (nl < 0) return;
      buf = buf.subarray(nl + 1);
      framed = true;
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: 0, result: {} })}\n`);
    }
    while (buf.length >= 9 && buf.length >= 9 + buf.readUInt32LE(5)) {
      const [channel, n] = [buf.readUInt32LE(0), buf.readUInt32LE(5)];
      const payload = buf.subarray(9, 9 + n);
      buf = buf.subarray(9 + n);
      if (channel !== 0) continue;
      const m = JSON.parse(payload.toString());
      if (m.method !== "terminal.attach") continue;
      process.stdout.write(frame(0, Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { channel: 1 } }))));
      process.stdout.write(frame(1, Buffer.from(`fake terminal ${m.params.terminal} attached\r\n`)));
    }
  });
  process.stdin.on("end", () => process.exit(0));
}
