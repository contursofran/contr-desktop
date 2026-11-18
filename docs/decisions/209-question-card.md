# One question card (#182)

- Permissions, agent questions (one pick and pick-any) and owner questions use one card. The parts are
  in `apps/desktop/src/renderer/chat/card/Card.tsx`; `chat/owner/OwnerCards.tsx` uses them.
- The card has the reply box's fill and line (`--side` as `bg-chrome`, `--input-line`) and no shadow,
  so it is part of the window (owner, 2026-11-17).
- The head has the red status glyph: the card needs the owner. Red is used only for that.
- Pick-any shows check boxes in place of the key numbers. The button's `aria-pressed` gives the state;
  the box is hidden from screen readers.
- The card shows only text that the source gives: "recommended" only where the source marks it, no
  "Run this command?" line. The option order stays the source's order, so each key picks the same answer.
- The keys line names only keys that work today. Esc does nothing on the card, so the line has no "esc".
- Key numbers, the keys line and details use `dim` (`--ink-50`), not the mock's `--ink-32` and
  `--ink-42`, which do not reach 4.5:1 in light (decision 198).
