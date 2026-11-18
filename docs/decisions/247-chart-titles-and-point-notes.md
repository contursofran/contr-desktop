# Chart titles, bar rows and point notes (#233, #213)

- Use 14 px bar rows for single-line labels and values, with 6 px between rows. The value
  and note share a right-aligned 120 px column.
- Put the optional title after the chart kind on the fence line. A pipe adds a mono subtitle.
  Use 12.5 px ink-85 for the title and 11 px ink-50 for the subtitle, with 10 px between them.
  Ink-50 gives the subtitle enough contrast in light (decision 198).
- Use an optional third field for a line point note. The latest point and the outlier show
  their notes after their values, separated by a middle dot.
- Cap the SVG at its 666-unit viewBox width in pixels so labels reach their specified sizes
  in a wide window. The SVG scales down in narrower windows.
