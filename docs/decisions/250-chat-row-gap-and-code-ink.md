# 250: Chat row gap and code ink

- Issue #236. The virtual list measures a 12 px separator between rows.
  It has 16 px of space after the last row, as in the mock's chat column
  (`docs/design/redesign/chat-screen.html`, `.col`).
- Issue #222, owner decision D137. Fenced code, including diffs, uses
  `--ink-85` in dark and light. Diff prefixes stay in the text. The language
  label stays `dim` (`--ink-50`) for light contrast (decision 198).
- The code block uses native text selection and sideways scroll.
  Copy gives the source text. Only an overflowing block takes a Tab stop.
- `docs/design/redesign/screens.html` shows the code frame. The app uses
  one ink token for all code text and no longer uses a highlighter.
