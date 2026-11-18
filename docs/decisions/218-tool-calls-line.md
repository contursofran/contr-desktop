# 218: Tool calls in one line, the answer footer, the compaction line

Issue #184, redesign. Mock: `docs/design/redesign/rich-parts.html` (Tool calls).

## Decision

- A `tools` row is one line: the helper's chip labels, joined with ", ", the next ones in lower case
  ("Read 6 files, ran 3 commands"). A button opens one line per call: the command or path, ✕ when it
  failed, the first line of its result. The chip icons go.
- A failed call shows ✕ in ink, as the design system's failed checks. Red is only for "needs you".
- The footer is the helper's `text` as it is, in mono. The app does not split or compute it.
- A `status` row is a thin centered line on hairlines.
- Text colors are `dim` (ink-50) and `ink-85`, not the mock's ink-30 to ink-45: in light, text must reach
  4.5:1 (decision 88).

## Not done

- The time on the tool line: the feed has no field for how long the calls took
  (contursofran/contr-core#22). The app does not guess it from the next row's `ts`.
