# 238: The 760 px chat column, the mock's headings, check boxes and hairlines

Issue #229, redesign. Mocks: `docs/design/redesign/chat-screen.html` (`.col`, `.bottom`, `h3`, `.meta`, `.fold`),
`screens.html` (`.chk`).

## Decision

- The reading column (`max-w-read`, `--container-read` in `index.css`) is 760 px: the chat rows, the cards, the
  status line and the reply box. It was 1000 px (`docs/design/recipe-herdr.md`).
- The chat list and the block of the cards, the status line and the reply box have the mock's 56 px side padding.
  Under 768 px of window width they keep 16 px: the mock has no narrow window, and at 640 px a 56 px padding leaves
  a 230 px column, too narrow for the status line's verb and "Orchestrating · 3 workers" (`reply.spec.ts`).
- At 1440 × 900 the column ends left of the Chat or Terminal switch. In a window narrower than about 1100 px the
  rows pass under the switch in the top fade, as on the mock.
- The virtual chat list has the mock's 12 px gap between rows (#236).
- The headings of an answer are the mock's `.col h3`: 14/20 px, weight 500, `--ink-100`. The margins give the mock's
  12 px row gap and 8 px more above. Cards keep their own headings.
- A task-list box is the mock's `.chk`: 14 px, radius 4, an `--ink-35` ring; on: an `--ink-85` fill and no ring.
  The box sits at the list's start and the text 10 px after it, with no list marker indent.
- The time line (`sep`) is on `--hairline`, as the compaction line and the mock's `.fold`. Both lines have 10 px
  gaps and 12 px text.
- Text colors stay `dim` (ink-50), not the mock's ink-30 and ink-35: in light they do not reach 4.5:1 (decision 198).

## Not done

- The answer footer as the mock ("18:38  2m 8s  8 tools", 14 px gaps, no dots, no "Worked"). The helper gives the
  footer as one `text`, and the protocol does not fix its format, so the app does not split it (decision 218).
  contursofran/contr-core#26 asks for the parts as fields.
