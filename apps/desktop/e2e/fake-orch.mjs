#!/usr/bin/env node
// A fake herdr-contr-orch for tests. `agents ls --all --json` lists four workers of the chat's agent (t1), one in
// each state, three of them live, and a b-30 of another project that the board must not show.
const workers = [
  { name: "b-30", parent: "t9", live: true, status: "blocked" },
  { name: "b-30", parent: "t1", live: true, status: "working" },
  { name: "b-40", parent: "t1", live: true, status: "blocked" },
  { name: "b-50", parent: "t1", live: true, status: "idle" },
  { name: "b-60", parent: "t1", live: false },
];
const args = process.argv.slice(2).join(" ");
if (args !== "agents ls --all --json") process.exit(2);
process.stdout.write(JSON.stringify(workers));
