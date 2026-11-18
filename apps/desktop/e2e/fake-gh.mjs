#!/usr/bin/env node
// A fake gh for tests. `api graphql` answers each `nN: issueOrPullRequest(number: N)` of the
// query from the table below; other numbers are null, as gh gives for unknown numbers.
// PRs #12, #14 and #15 have checks (passed, failed, running). FAKE_GH_LOG gets one JSON line per call: the numbers it asked for.
// `pr list --state merged` gives two PRs (#12, #70); `pr list --state open` gives #14 (checks pass) and #51 (a check failed).
// FAKE_GH_PR_LOG gets the arguments of each `pr list` as one JSON line.
import { appendFileSync } from "node:fs";

// The head's check rollup: its state, and the count of check runs in each state.
const rollup = (state, runs) => ({
  commits: { nodes: [{ commit: { statusCheckRollup: { state, contexts: {
    totalCount: Object.values(runs).reduce((a, b) => a + b, 0),
    checkRunCountsByState: Object.entries(runs).map(([s, count]) => ({ state: s, count })),
    statusContextCountsByState: [],
  } } } }] },
});
const pr = (n, state, isDraft = false, checks = {}) => ({ __typename: "PullRequest", state, isDraft, url: `https://github.com/o/r/pull/${n}`, ...checks });
const issue = (n, state, stateReason = null) => ({ __typename: "Issue", state, stateReason, url: `https://github.com/o/r/issues/${n}` });
const table = {
  9: issue(9, "CLOSED", "COMPLETED"),
  12: pr(12, "MERGED", false, rollup("SUCCESS", { SUCCESS: 6 })),
  14: pr(14, "OPEN", false, rollup("FAILURE", { SUCCESS: 5, FAILURE: 1 })),
  15: pr(15, "OPEN", true, rollup("PENDING", { SUCCESS: 4, IN_PROGRESS: 2 })),
  20: pr(20, "CLOSED"),
  21: issue(21, "OPEN"),
  22: issue(22, "CLOSED", "NOT_PLANNED"),
  30: issue(30, "OPEN"),
  31: pr(31, "OPEN"),
  40: issue(40, "OPEN"),
  41: pr(41, "OPEN", true),
  50: issue(50, "OPEN"),
  51: pr(51, "OPEN"),
  60: issue(60, "OPEN"),
  70: pr(70, "MERGED"),
};
const args = process.argv.slice(2);
if (args[0] === "pr" && args[1] === "list") {
  if (process.env.FAKE_GH_PR_LOG) appendFileSync(process.env.FAKE_GH_PR_LOG, `${JSON.stringify(args)}\n`);
  const merged = [{ number: 12 }, { number: 70 }];
  const open = [{ number: 14, statusCheckRollup: [{ conclusion: "SUCCESS" }] }, { number: 51, statusCheckRollup: [{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }] }];
  process.stdout.write(JSON.stringify(args.includes("merged") ? merged : open));
  process.exit(0);
}
if (args[0] !== "api" || args[1] !== "graphql") process.exit(1);
const query = args.find((a) => a.startsWith("query=")) ?? "";
const numbers = [...query.matchAll(/number: (\d+)/g)].map((m) => Number(m[1]));
if (process.env.FAKE_GH_LOG) appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify(numbers)}\n`);
// A checks query (contr-status board): each issue's closing PR and the state of its checks.
const closing = { 30: [31, "SUCCESS"], 40: [41, "PENDING"], 50: [51, "FAILURE"] };
const prOf = ([number, state]) => ({ closedByPullRequestsReferences: { nodes: [{ number, commits: { nodes: [{ commit: { statusCheckRollup: { state } } }] } }] } });
const checks = query.includes("closedByPullRequestsReferences");
const answer = (n) => (checks ? (closing[n] ? prOf(closing[n]) : null) : (table[n] ?? null));
const repository = Object.fromEntries(numbers.map((n) => [`n${n}`, answer(n)]));
process.stdout.write(JSON.stringify({ data: { repository } }));
process.exit(numbers.every((n) => answer(n)) ? 0 : 1);
