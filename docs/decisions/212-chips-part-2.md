# Chips, part 2: PR checks, worker, owner item, decision and file chips (#188)

- The PR read of `refs` (`main/refs/gh.ts`) also asks gh for the head commit's check rollup:
  its state and the count of each check state (`checkRunCountsByState`,
  `statusContextCountsByState`). `RefState` of a PR gets `checks` (`CheckCounts`), absent when
  the PR has no checks. Passed: SUCCESS, NEUTRAL, SKIPPED. Failed: FAILURE, ERROR, TIMED_OUT,
  CANCELLED, ACTION_REQUIRED, STARTUP_FAILURE. It is the same gh call as before, so the cache
  (one call per number per minute) does not change.
- A PR chip shows its checks after the number as the mock does: `✓ 6/6` in `ink-45`, the working
  glyph and `4/6` while they run, `✕ 1` (the failed count) in `ink-100`. Not red: the glyph says
  the state. The checks are `select-none`, so a copied selection keeps only `#12`. The chip's label
  adds them, for example "PR #12, Merged, 6 of 6 checks passed". A chip with no checks keeps its
  label as before.
- New chips in `chat/refs`, each one a component that takes its data as props. The later blocks
  (board, queue, recorded rows, PR card) give them data from the orchestration tool:
  - `WorkerChip`: the status glyph (`ui/StatusGlyph.tsx`) and the name, neutral outline. A done
    worker has no glyph: the status glyph has no done state.
  - `OwnerChip`: a question (circle with a question mark, with its title) or a to-do (square).
    The outline is `--blocked` at 35 % while the item is open, else neutral.
  - `DecisionChip`: the id in mono with the neutral outline, no icon. The mock has no decision chip.
  - `FileChip`: a file icon and the path.
  The neutral outline is `--hairline` (the mock's `.chip`). These chips open nothing yet (a
  `span`, not a link): the mock does not say what a click on them opens.
- No new text patterns in the Markdown pipeline: the chat finds only `#12` in text, as before.
- No chat part uses the new chips yet. The e2e `chip-parts` puts their markup in a chat row of the
  real window, so that the app's CSS and tokens draw them for the screenshots.
