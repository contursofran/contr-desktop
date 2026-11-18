# The terminal in the redesign (#186)

- The terminal has no frame. It fills the area under the tab bar with the inset of the mock
  (`docs/design/redesign/screens.html`, screen 5): 16 px top, 24 px left and right, 18 px bottom.
- The terminal text is JetBrains Mono 13/20, the bundled `--font-mono`. The colors stay the tokens of
  decision 198.
- xterm.js measures its cell when it opens. The view opens it after `document.fonts.load` gives the
  bundled font, so that cols and rows are right at the attach. When the font does not load, the
  terminal opens with the fallback font.
- xterm.js has a line height factor, not a line height in px. A row is
  `floor(ceil(font height × dpr) × lineHeight)` device px; the font height is the font's ascent and
  descent. The view calculates the factor for 20 px from the same metrics (`lineHeight()` in
  `TerminalView.tsx`).
- When hc ends the connection or cannot attach, the terminal shows one centered note
  (`terminal/TerminalNotice.tsx`), not the boxed `ui/ErrorNote.tsx`: the text in `--ink-100`, the
  reason in mono, and Retry with an `--input-line` ring. The reason is `dim` (`--ink-50`), not
  `--ink-45` as in the mock, for 4.5:1 in light. The role, the label "Terminal error" and Retry do
  not change.
