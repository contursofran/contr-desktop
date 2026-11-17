# Card keys and the Tab order (#101)

- Card number keys answer from anywhere in the window, except in a text field, a `select`, a contenteditable, or a `menu`, `listbox` or `combobox` (owner, 2026-11-17). Enter goes to a card only when the focus is on no button or link.
- Escape does nothing on an approval or question card: the recipe gives Escape to the panel card only.
- The recipe has no key that moves the focus to the reply box. The cards, the status line and the reply box come before the chat rows in the DOM, and `order-last` shows them under the rows. Tab reaches them first; chips and Copy buttons follow.
- A code block is a Tab stop only while it scrolls sideways.
