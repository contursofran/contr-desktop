#!/usr/bin/env node
// A fake hc for tests. `get --json <terminal>` gives FAKE_HC_TITLE (else the terminal's title below) and FAKE_HC_CWD.
// `machine ls --json` gives two machines when FAKE_HC_AGENTS=1, else none.
// `ls --json` lists the agents below when FAKE_HC_AGENTS=1, else none. `events` ends at once: the app polls.
const agents = [
  { address: "t7", name: "orch-contr-desktop", cwd: "/work/contr-desktop", status: "working", title: "Chat panel usability audit" },
  { address: "t8", cwd: "/work/contr-desktop-wt/agent/30", parent: "t7", status: "working" },
  { address: "t9", cwd: "/work/contr-desktop-wt/agent/40", parent: "t7", status: "done" },
  { address: "t10", cwd: "/work/contr-desktop-wt/agent/50", parent: "t7", status: "done" },
  { address: "t11", name: "notes", cwd: "/work/contr-desktop", status: "done", title: "Release notes draft" },
  { address: "t12", cwd: "/work/herdr-contr", status: "working", title: "Install health check" },
  { address: "t13", name: "term-1", cwd: "/work/herdr-contr" },
].map((t) => ({ ...t, state: "live" }));
const [cmd, , terminal] = process.argv.slice(2);
if (cmd === "get") {
  const title = process.env.FAKE_HC_TITLE ?? agents.find((t) => t.address === terminal)?.title ?? "";
  process.stdout.write(`${JSON.stringify({ address: terminal, name: "w-7", title, cwd: process.env.FAKE_HC_CWD ?? "" })}\n`);
} else if (cmd === "machine") {
  const machines = [
    { name: "aerum-pc", state: "connected" },
    { name: "vps", state: "unreachable", why: "no answer" },
    { name: "tmp-1", state: "connected", temporary: true },
  ];
  process.stdout.write(JSON.stringify({ machines: process.env.FAKE_HC_AGENTS === "1" ? machines : [] }));
} else if (cmd === "ls") {
  const list = process.env.FAKE_HC_AGENTS === "1" ? agents.map((t) => ({ ...t, title: undefined })) : [];
  process.stdout.write(JSON.stringify({ terminals: list }));
} else process.exit(1);
