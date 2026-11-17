# The ↓ button that goes back to the end of the chat (#114)

- The button shows only while the chat list is not at its end (the list's own "at the end" test, 10% of the viewport). At the end there is no button, so it covers no row there.
- It is 34 px, round, `raised` fill, `border` frame, a 15 px `foreground` arrow, 12 px over the bottom of the list, as the `jump` button of herdr-contr's chat.
- A new last row that comes while the owner reads older rows turns the arrow `accent` and adds the description "New messages". The design has no count, so there is none. Older rows that load at the top do not mark it. The mark clears at the end.
- Its name is "Jump to the end". It comes before the rows in the DOM, so Tab reaches it right after the reply box (see `109-keys.md`).
- After a press the button goes away, and the focus goes to the page. The design does not say where the focus goes next.
