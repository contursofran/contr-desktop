# 38: Virtual chat list

- The chat rows render in `@legendapp/list` (as t3code). Only rows near the
  viewport are in the DOM. With 2000 rows, RSS went from 548–583 MB to
  448–450 MB.
- The list opens at the end and follows new rows while it is within 10 % of
  the end. When the owner scrolled up, it stays put.
- Size anchoring keeps the rows on screen still when a row above changes
  height.
- The list keeps `aria-label="Chat"`. Rows are `role=listitem` with
  `data-row-id`. Tests find rows by id, not by DOM count.
- Find in page sees only the rendered rows. It is out of scope here.
