#!/usr/bin/env node
// A fake herdr-contr-orch for tests. `agents ls --all --json` lists four workers, one in each state.
const workers = [
  { name: "b-30", live: true, status: "working" },
  { name: "b-40", live: true, status: "blocked" },
  { name: "b-50", live: true, status: "idle" },
  { name: "b-60", live: false },
];
const args = process.argv.slice(2).join(" ");
if (args !== "agents ls --all --json") process.exit(2);
process.stdout.write(JSON.stringify(workers));
