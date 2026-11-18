# The status line and the reply box foot as the mock (#230, #221)

- The status line takes the mock's `.status` (`docs/design/redesign/screens.html`): 12 px text,
  time and tokens in 11 px mono, a 10 px gap and 4 px at each side. The glyph stays 13 px `working`.
- The text is `dim` (ink-50), as the mock. The mock's mono is `--ink-38`; it is `dim` too, because
  ink-38 does not reach 4.5:1 in light (decision 198).
- The model button shows no chevron after the effort, as `chat-screen.html` `.rf`. Screen 1 of
  `screens.html` shows "medium ▾": the two mocks do not agree, and the issue names `chat-screen.html`.
- At 80% or more, the context ring and the percent are `ink-100`, not red: red is only "needs you"
  (D134). The "Not sent" alert stays `error`, which is `ink-100` (decision 198).
- The Chat or Terminal switch has an 18 px line height, so it is 28 px high, as `.seg`. Its top
  (52 px under the top of the work area) and its right (14 px) were already as the mock.
- The branch in the reply box foot was already there: it comes from `git branch --show-current` in
  the agent's folder (`main/refs/branch.ts`). It does not show when git gives no branch.
