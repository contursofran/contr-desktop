# 152: One card owns the keys; stacked cards scroll (#139)

- One card owns the card keys (1-9, Enter). A shown agent's card owns them first, because it blocks the agent. Otherwise the first owner question owns them. An owner question that does not own the keys shows no key badges and takes no keys. The Inbox cards never own the keys, so they show no key badges.
- In the agent's question card, Enter, Next and Send act only when the current question has a pick or own text. An answer with nothing in it does not go out.
- The cards are in a block of at most 45% of the window height, and the block scrolls inside. The status line and the reply box stay under it. The chat list keeps at least 120 px, so a taller reply box takes room from the cards.
- The cards block starts scrolled to its end. The agent's card, next to the reply box, stays in view. The owner cards are above it in the scroll.
