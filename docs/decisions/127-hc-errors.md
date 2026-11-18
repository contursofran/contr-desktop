# Terminal and hc errors (#115)

- `ui/ErrorNote.tsx` shows the helper error and "hc is not reachable" in the main column. It uses the card style from #110 and shows the problem in plain words, the raw error in monospace, and Retry.
- When attach fails or the stream ends, `terminal/TerminalNotice.tsx` shows the error over the terminal (see #205). Retry resets the screen and attaches again. hc's stderr goes into the raw error.
- With hc down, the list is unknown, not empty: the Projects part says "hc is not reachable", not "No agents" (this replaces that line of 110-error-empty-states.md). Retry asks main for the list, and main reads it again at once when the last read failed. The 10 s poll stays.
- One name: the texts the owner reads say `hc`, as the design docs and Settings do. "herdr-core is not running." is now "hc is not running."
- The terminal attach runs the program that `CONTR_HC` names, as the sidebar does, so e2e runs use the fake hc.
