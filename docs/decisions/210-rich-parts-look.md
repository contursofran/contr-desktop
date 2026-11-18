# The look of remarks, code, tables, images, links and the owner's message (#183)

- Source: `docs/design/redesign/screens.html`, screens 2 and 3. Tokens only; no new color.
- Remarks are a label column (110 px) and the text, with no bar. The labels are `dim` (`--ink-50`), not
  `--ink-45` as on the mock: in light, `--ink-45` does not reach 4.5:1 (decision 198). Only
  "Decision needed" is `--blocked`, because it waits for the owner.
- Code blocks and tables have hairlines and no fill. The code language label is `dim` for the same reason.
  Decision D137 (#222) uses plain ink (`--ink-85`) for code, including diffs.
- Links are `--ink-100` with a 1 px `--ink-30` underline (`text-decoration`, so a link that wraps keeps
  its line on each part).
- The answer type (13.5/21 px, `--ink-85`) is only on the agent's answer row: `ChatMarkdown` takes
  `answer`, so the owner cards keep their own size.
- The mocks have no owner's message. It is a right-aligned block with `--selected` and
  `--shadow-selected`, the fill of a selected row. The owner can change this.
