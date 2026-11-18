# Bar and line charts as a contr-chart block (#195)

- One block, `contr-chart`, with the kind in the fence meta: `contr-chart bar` or `contr-chart line`.
  An optional title follows the kind on the same line. A pipe adds a quieter mono part, as in
  `contr-chart bar Tokens per worker | this run`. `ChatMarkdown` passes the meta (`dataCodeMeta`)
  to `contrBlock`.
- A bar row has `<label> | <value> | <note>`. A line point has `<x> | <y>` and can add `| <note>`.
  A value is a number with an optional unit. `k` and `M` scale it, so `412k` sorts above `61k`.
  All values of one chart have the same unit.
- Bars are sorted, largest first, and the largest bar is full width. Grey only: `ink-26` track,
  `ink-60` fill.
- The line has its latest point in `ink-100` with its value. One outlier gets its value as a label:
  the point farthest from the median, other than the latest, when its modified z-score
  (0.6745 × distance / median absolute distance) is above 3.5. With fewer than 5 points, no label.
  Both labels include a point note when supplied, as in `9.4 · #31`. The SVG stops growing at 666 px.
- Limits: 12 bars, 2 to 60 points. A block past a limit, with a negative bar, mixed units or an
  unknown kind shows as code.
- The title subtitle, bar identifiers and line axis labels use `dim` (`ink-50`) to reach 4.5:1
  in the light theme (decision 198).
- Plain SVG and DOM; no chart library.
