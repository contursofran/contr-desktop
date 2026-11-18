# The Inbox as a list with one open item (#185)

- The Inbox is one row per item: glyph, id, text, then kind, title, where it is from and the
  coordinator's name, and the end. Questions and to-dos come first, oldest first (`owner open
  --json`). The agents blocked on a prompt come after them, as on the mock (screen 4): they have
  no age to sort by.
- One item is open as its card: the oldest, until the owner opens another with a press on its
  row or with Arrow Down and Arrow Up. When the open item closes, the oldest opens.
- The open card takes the digit and Enter keys, as the coordinator's chat does. Before, the
  Inbox showed every card at once and took no keys.
- The card is the owner card of the chat (`chat/owner/OwnerCards.tsx`). #182 gives it the
  question card's look; this change does not restyle it.
- The ends: a question shows its number of answers; a to-do has a Done button that marks it
  done with no need to open it; a blocked agent shows "Open chat", and a press opens its chat.
- Glyphs: a question and a blocked agent are "needs you" (red); a to-do is idle. The ids, the
  line under the text and the ends use `dim` (`--ink-50`), not the mock's `--ink-38` and
  `--ink-42`, which do not reach 4.5:1 in light (decision 198).
- A blocked agent's row shows its title and "Waits on a prompt". The mock shows the prompt
  itself (for example "Bash: pnpm ..."); the Inbox does not have the agent's card data.
