# The `contr-pr` block (#193)

- The agent writes only the PR number. The app reads all else; nothing comes from the agent's text.
- One `gh pr view <n> --json …` call gives all GitHub data: the PR, the checks of its head with their
  start and end times, the latest review and gh's merge state. `gh pr checks` is not needed.
- The worker comes from the orchestration tool (`agents ls --all --json`): its worktree ends with the
  PR's branch, else its issue is the branch's number. The chat's own workers come first.
- A value that no source gives is not shown: the failing test's name (gh gives the check only), a note
  on a running check, and an order of PRs for "Merge: after #70".
- A check that is queued (no start time) shows the waiting glyph and "queued"; a skipped check shows ✓
  and "skipped". The mock has no answer for these two.
- The card asks every 30 s, as gh and the tool send no event; main keeps a read 20 s, so cards of one
  PR share one run. A failed check is ink, not red: red is only for "needs you".
