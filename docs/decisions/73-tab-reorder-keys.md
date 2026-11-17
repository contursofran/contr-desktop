# Tab reorder: keys and drag look (PR 73)

- A tab moves with Alt and Left, Right, Home or End while it has focus. Space and Enter stay the
  tab's own keys (they select it), so UI SDK's pick-up keys are not used.
- During a drag, a copy of the tab follows the pointer (UI SDK's `preview`). The tab's own place
  shrinks to a 2 px `working` line where it will drop, as the design says.
- The open tabs and their order are kept in localStorage `tabs.open`. At start, a saved tab whose
  terminal hc does not list (`hc get` fails and `hc ls` runs and does not name it) closes. While hc
  fails, no saved tab closes and the list is not saved (#143).
