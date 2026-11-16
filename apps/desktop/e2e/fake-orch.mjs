#!/usr/bin/env node
// A fake herdr-contr-orch for tests. `agents ls --all --json` lists four workers, one in each state.
// The live ones are the hc terminals t8 to t10 of fake-hc.mjs, under the orchestrator t7.
const workers = [
  { name: "b-30", address: "t8", parent: "t7", live: true, status: "working", title: "Flow and sequence diagrams" },
  { name: "b-40", address: "t9", parent: "t7", live: true, status: "blocked", title: "Cards for prompts and questions" },
  { name: "b-50", address: "t10", parent: "t7", live: true, status: "idle", title: "Virtual list" },
  { name: "b-60", live: false },
];
const args = process.argv.slice(2).join(" ");
if (args !== "agents ls --all --json") process.exit(2);
process.stdout.write(JSON.stringify(workers));
