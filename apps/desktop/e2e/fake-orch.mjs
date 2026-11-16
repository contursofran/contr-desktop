#!/usr/bin/env node
// A fake herdr-contr-orch for tests. `agents ls --all --json` lists four workers of the chat's agent (t7), one in
// each state, three of them live, and a b-30 of another agent (t12) that the board must not show.
// With FAKE_ORCH_NONE=1 it lists no workers.
// The live ones of t7 are the hc terminals t8 to t10 of fake-hc.mjs.
const workers = [
  { name: "b-30", parent: "t12", live: true, status: "blocked" },
  { name: "b-30", address: "t8", parent: "t7", live: true, status: "working", issue: "30", title: "Flow and sequence diagrams" },
  { name: "b-40", address: "t9", parent: "t7", live: true, status: "blocked", issue: "40", title: "Cards for prompts and questions" },
  { name: "b-50", address: "t10", parent: "t7", live: true, status: "idle", title: "Virtual list" },
  { name: "b-60", parent: "t7", live: false },
];
const args = process.argv.slice(2).join(" ");
if (args !== "agents ls --all --json") process.exit(2);
process.stdout.write(JSON.stringify(process.env.FAKE_ORCH_NONE === "1" ? [] : workers));
