# The `contr-pr` block (#193)

- The agent writes only the PR number. The app reads all else; nothing comes from the agent's text.
- One GitHub GraphQL read gives the PR, its latest review, merge state and checks for the two latest
  commits. The card reads annotations by run ID for displayed failed checks (#235).
- The worker comes from the orchestration tool (`agents ls --all --json`): its worktree ends with the
  PR's branch, else its issue is the branch's number. The chat's own workers come first.
- The card shows the first failure annotation that has text. It pairs a running check with a failed
  check on the previous commit when the workflow, event and job match and the failure ended first.
- The merge line uses GitHub's merge state. The coordinator's merge order needs a source
  (contursofran/contr-core#35).
- A check that is queued (no start time) shows the waiting glyph and "queued"; a skipped check shows ✓
  and "skipped". The mock has no answer for these two.
- The card asks every 30 s, as gh and the tool send no event; main keeps a read 20 s, so cards of one
  PR share one run. A failed check is ink, not red: red is only for "needs you".
