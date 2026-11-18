# 245: The tab bar and the sidebar head as the mock (#228, #241, #246)

- The status glyph on a tab is the mock's `.tab .g` (`screens.html`): 12 px in a 10 px box. The sidebar's glyph stays 15 px in a 14 px box (`.g`). `StatusGlyph` has a `small` switch for the tab.
- A tab is at most `--tab-max-width` (180 px, `tokens.css`) wide, its icon, glyph and × included. A longer title is cut with "…". The tooltip has the full title. The label's own 170 px limit is gone. The mock's picture shows a 236 px tab with a whole title; the token wins, as #228 says.
- The Inbox row is 2 px under the 40 px head (`screens.html` `.nav`, `margin-top: 2px`), not 6 px. The Projects label stays 6 px under it (`.head`, `margin-top: 6px`).
- The idle glyph ⠶ stays ink-30 in light. On the light screenshot at 2x it shows clearly on the idle rows (b-50 "Virtual list", "Install health check"). In the #239 screenshot b-50 had no glyph because the fake hc said done, and a done agent has no glyph (#217), not because ink-30 is too faint. ink-30 is the status glyph's own token (decision 198).

- A done agent or worker outside the shown chat has a 4 px ink-100 dot centered in the 14 px sidebar glyph slot. Its screen-reader label is `unread`. The dot goes when the chat is shown. The row title keeps its normal weight (D144 and D145).
