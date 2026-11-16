#!/usr/bin/env node
// A fake gh for tests. `api graphql` answers each `nN: issueOrPullRequest(number: N)` of the
// query from the table below; other numbers are null, as gh gives for unknown numbers.
// FAKE_GH_LOG gets one JSON line per call: the numbers it asked for.
import { appendFileSync } from "node:fs";

const pr = (n, state, isDraft = false) => ({ __typename: "PullRequest", state, isDraft, url: `https://github.com/o/r/pull/${n}` });
const issue = (n, state, stateReason = null) => ({ __typename: "Issue", state, stateReason, url: `https://github.com/o/r/issues/${n}` });
const table = {
  9: issue(9, "CLOSED", "COMPLETED"),
  12: pr(12, "MERGED"),
  14: pr(14, "OPEN"),
  15: pr(15, "OPEN", true),
  20: pr(20, "CLOSED"),
  21: issue(21, "OPEN"),
  22: issue(22, "CLOSED", "NOT_PLANNED"),
};
const args = process.argv.slice(2);
if (args[0] !== "api" || args[1] !== "graphql") process.exit(1);
const query = args.find((a) => a.startsWith("query=")) ?? "";
const numbers = [...query.matchAll(/number: (\d+)/g)].map((m) => Number(m[1]));
if (process.env.FAKE_GH_LOG) appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify(numbers)}\n`);
const repository = Object.fromEntries(numbers.map((n) => [`n${n}`, table[n] ?? null]));
process.stdout.write(JSON.stringify({ data: { repository } }));
process.exit(numbers.every((n) => table[n]) ? 0 : 1);
