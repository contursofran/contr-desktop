# The open Inbox item is its row (#232)

- The open row is the card, as the mock (screens.html screen 4, `.ibx.is-open`): the row's grid
  with the `--side` fill, the `--panel-line` line and a 12 px radius. The glyph stays in the first
  column; the body spans the other columns. There is no second card and no second glyph.
- The head is the id, then the closed row's kind line: kind, title, from, coordinator.
- The Inbox has its own parts for the open item (`inbox/OpenItem.tsx`), not the chat's owner card
  (`chat/owner/OwnerCards.tsx`). They take the shared pieces of `chat/card/Card.tsx`. The chat's
  card and the Inbox can show the same item in two forms.
- The recommended answer, else the first, is picked while no own answer is typed. Enter and
  "Send answer" send it. A press on an answer or its digit still sends that answer at once.
- A ref `#n` is a `RefChip` with gh's state, as in the chat. Other refs are mono text.
- Text under 4.5:1 in light keeps `dim` (`--ink-50`), as decision 198 says.
