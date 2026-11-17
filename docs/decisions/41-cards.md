# 41: Cards read the helper's `card` on the feed tick

- The card comes from the helper's `card` command, not from `perm` and
  `question` rows: only `card` knows that the prompt is on screen now, and
  its `request` is the id that `approve` and `answer` check.
- Main reads `card` on the same 1 s tick as `feed` and `working`. The helper
  has no event for a prompt on screen.
- The keys go through `approve` and `answer` only. The app never types raw
  keys for a card: the helper's guard checks the prompt first.
- Card keys (1-9, Enter) work from anywhere in the window (owner, #101). They
  do nothing while focus is in the reply box, the own-answer box, another
  field or an open menu. Enter on a focused button or link presses that
  control. The choices have `aria-keyshortcuts`.
- Approval: 1 allows once, 2 denies. A question: 1-9 picks an option (a
  one-choice pick moves on), the number after the options goes to the
  own-answer box, Enter goes on or sends.
- Approval: the buttons stay off after `sent`, `unconfirmed`, `answered` and
  `changed` (the next `card` read shows the new prompt), and come
  back after `busy`, `failed` and `no-identity`.
- The card is in the layout between the chat list and the reply box. The chat list gets shorter and stays at its end when a card appears or grows, unless the owner scrolled up.
