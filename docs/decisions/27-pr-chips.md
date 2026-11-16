# PR and issue chips (#27)

- The chat finds the agent's repository in `CONTR_REPO_DIR`, else in the hc
  terminal's cwd (`hc get --json`, read-only). The sidebar step can replace
  this with the project's folder.
- Main asks `gh api graphql` once for many numbers and keeps each state for
  60 s. The renderer asks again every 60 s: GitHub sends no event to the app.
- Live chips show only in the agent's answers (`docs/design/chat-blocks.md`).
  The owner's bubbles stay plain text.
- `changeRequestLinks.ts` from t3code is not copied: it needs t3code's
  project model, and gh gives the URL.
