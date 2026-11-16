# Tab reorder: keys and drag look (PR 73)

- A tab moves with Alt and Left, Right, Home or End while it has focus. Space and Enter stay the
  tab's own keys (they select it), so UI SDK's pick-up keys are not used.
- During a drag, a copy of the tab follows the pointer and the tab shows faded where it will drop
  (UI SDK's `preview`). The design's drop line is not built.
- The open tabs and their order are kept in localStorage `tabs.open`.
- The owner can change these after the UI SDK trial (#72).
