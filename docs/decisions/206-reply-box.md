# The reply box and the status line of the redesign (#181)

- The status line follows `docs/design/redesign/screens.html`, screen 1: the status glyph
  (`ui/StatusGlyph`, working, 13 px), the verb, time and tokens in mono, and
  "Orchestrating · N workers" on the right, all 13 px. The 80 ms loader stays on the tabs and
  the sidebar. The glyph keeps the screen-reader label "running".
- The reply box has the `--side` fill and the `--input-line` border, as the question card
  (owner's decision of 2026-11-17), 12 px corners and the mock's padding.
- The foot is `dim` (ink-50). The model is `ink-85`. The context and the branch are 11 px mono
  `dim`, not `--ink-42` as on the mock (decision 198: ink-42 does not reach 4.5:1 in light).
- The model button shows the agent icon (`ui/AgentIcon`): the Claude pet for `claude`, Codex's
  picture for `codex`, a bot for another kind, the sparkle while the helper does not know the agent.
- The context ring stays (the issue keeps it working as today); the mock shows only the percent.
  The ring is red at 80% or more, as before.
- The send button of the empty box is `--hover-strong` with a `dim` arrow, as the mock. With text
  it keeps the `foreground` fill: the mock has no answer for it.
- The box keeps two rows. One row, as the mock, waits for #204 (the ↓ button stops 2 px short).
- A "Not sent" error is `error` ink, not red: red is only "needs you".
