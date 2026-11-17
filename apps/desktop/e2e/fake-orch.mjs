#!/usr/bin/env node
// A fake herdr-contr-orch for tests. `agents ls --all --json` lists four workers of the chat's agent (t7), one in
// each state, three of them live, and a b-30 of another agent (t12) that the board must not show: it has no hc terminal, so it is not live (#57).
// With FAKE_ORCH_NONE=1 it lists no workers; FAKE_ORCH_LIST (a JSON file) is the list in place of the one below.
// The live ones of t7 are the hc terminals t8 to t10 of fake-hc.mjs.
// `owner open --json` prints the list in FAKE_ORCH_OWNER (a file; none: an empty list). `owner answer <id> <answer>` and
// `owner done <id>` remove the item from that file. FAKE_ORCH_OWNER_FAIL=1 makes them fail with a message and change nothing;
// FAKE_ORCH_OWNER_UNREACHED=1 makes them remove the item and say "coordinator not reached".
// While the file in FAKE_ORCH_OWNER_BAD exists, `owner open --json` prints its text (a read that gives no JSON list).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const workers = [
  { name: "b-30", parent: "t12", live: true, status: "blocked" },
  { name: "b-30", address: "t8", parent: "t7", live: true, status: "working", issue: "30", title: "Flow and sequence diagrams" },
  { name: "b-40", address: "t9", parent: "t7", live: true, status: "blocked", issue: "40", title: "Cards for prompts and questions" },
  { name: "b-50", address: "t10", parent: "t7", live: true, status: "idle", title: "Virtual list" },
  { name: "b-60", parent: "t7", live: false },
];
const argv = process.argv.slice(2);
const args = argv.join(" ");
const file = process.env.FAKE_ORCH_OWNER;
const open = () => (file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []);
if (args === "agents ls --all --json") {
  const list = process.env.FAKE_ORCH_LIST ? JSON.parse(readFileSync(process.env.FAKE_ORCH_LIST, "utf8")) : workers;
  process.stdout.write(JSON.stringify(process.env.FAKE_ORCH_NONE === "1" ? [] : list));
} else if (args === "owner open --json") {
  const bad = process.env.FAKE_ORCH_OWNER_BAD;
  process.stdout.write(bad && existsSync(bad) ? readFileSync(bad, "utf8") : JSON.stringify(open()));
} else if (argv[0] === "owner" && (argv[1] === "answer" || argv[1] === "done") && argv[2]) {
  if (process.env.FAKE_ORCH_OWNER_FAIL === "1") {
    process.stderr.write(`owner ${argv[1]}: the owner file is locked\n`);
    process.exit(1);
  }
  const list = open();
  if (!list.some((i) => i.id === argv[2])) {
    process.stderr.write(`no open item ${argv[2]}\n`);
    process.exit(1);
  }
  writeFileSync(file, JSON.stringify(list.filter((i) => i.id !== argv[2])));
  if (file) writeFileSync(`${file}.log`, `${argv.slice(1).join(" ")}\n`, { flag: "a" });
  if (process.env.FAKE_ORCH_OWNER_UNREACHED === "1") {
    process.stderr.write(`coordinator not reached: ${argv[2]}\n`);
    process.exit(1);
  }
} else process.exit(2);
