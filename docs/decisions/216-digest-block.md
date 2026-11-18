# The `contr-digest` block (#192)

- The agent writes an empty `contr-digest` block. The app fills it; no number comes from the agent.
- Merges and CI failures come from gh in the agent's repository; busy workers and owner items from the
  orchestration tool, for the chat's agent only.
- "Since you left" starts at the owner's message before the last one: the last one is the question
  that the digest answers. Main keeps the owner's message times from the feed splices it already
  relays; there is no new helper call.
- CI failures are the open PRs with a failed check on their head now, not the failed runs since the
  owner left: a run that passed again is no longer a failure.
- The block asks every 30 s, as gh and the tool send no event; main keeps a read 20 s, so all digest
  blocks on screen share one run.
- A count whose source failed shows "–". Red is only for a count of owner items above 0.
