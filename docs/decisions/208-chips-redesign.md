# PR and issue chips in the redesign (#188)

- A PR or issue chip has the shape of the mock (`docs/design/redesign/rich-parts.html`, Chips):
  JetBrains Mono 12 px, 20 px high, 6 px corners, the icon at 13 px. It stays an inline box, not
  flex, so that a copied selection keeps `#12` on its line.
- The state token `--color-pr-*` or `--color-issue-*` goes in the variable `--st`. The icon has
  this color; the outline is the same color at 38 % (`color-mix`). The number is `--ink-100`.
- A closed PR is grey (`--color-pr-draft`), not red: red only means "needs you" (the owner,
  2026-11-18). `--color-pr-closed` stays in `index.css` for `--ui-destructive`; the chips do not
  use it.
- A closed PR and a not-planned issue show their number in `dim` (`--ink-50`), as the mock's
  `is-dim`. In light this is 4.5:1 (decision 198).
- Not done here, open questions for the owner:
  - The checks on a PR chip (✓ n/n, ⠋ running, ✕ failed): the app has no check data for a
    chip. `RefState` (gh) gives only the kind, the state and the URL. Must `refs` also get the
    checks from gh, in a new issue?
  - Worker (`b-31`), owner item (`D7`, `T3`), decision (`D112`) and file path chips: the chat
    does not find these in the text yet, and the mock has no decision chip. Are these new issues,
    and what does a decision chip look like?
