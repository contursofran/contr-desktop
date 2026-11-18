# Bar and line charts as a contr-chart block (#195)

- One block, `contr-chart`, with the kind in the fence meta: `contr-chart bar` or `contr-chart line`,
  as the mock writes it (`docs/design/redesign/rich-parts.html`). `ChatMarkdown` passes the meta
  (`dataCodeMeta`) to `contrBlock`.
- Bar: `<label> | <value> | <note>`. Line: `<x> | <y>`. A value is a number with an optional unit;
  `k` and `M` scale it, so `412k` sorts above `61k`. All values of one chart have the same unit.
- Bars are sorted, largest first, and the largest bar is full width. Grey only: `ink-26` track,
  `ink-60` fill.
- The line has its latest point in `ink-100` with its value. One outlier gets its value as a label:
  the point farthest from the median, other than the latest, when its modified z-score
  (0.6745 × distance / median absolute distance) is above 3.5. With fewer than 5 points, no label.
- Limits: 12 bars, 2 to 60 points. A block past a limit, with a negative bar, mixed units or an
  unknown kind shows as code.
- Text is `dim` (`ink-50`) at the least, not the mock's `ink-38` and `ink-35`, so that light reaches
  4.5:1 (decision 198).
- Plain SVG and DOM; no chart library.
