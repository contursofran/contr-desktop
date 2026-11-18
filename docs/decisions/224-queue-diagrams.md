# The queue rail and the flow and sequence diagrams (#190)

- `contr-queue` is a rail as in `rich-parts.html` (Merge queue). The step state comes from gh
  through `useRefState`: a merged PR or a closed issue is done; the first step that is not done
  is now; the rest are next. Each row reports its done state to the list, because a block that
  streams in can get more lines, and a hook for each step in one component would then break.
- A `#n` in a queue note is a `RefChip`, as `#n` is in chat text. The note has no other chips:
  the block text has no worker, owner item or file field, and decision 212 adds no new text
  patterns.
- The step number and the note use `text-dim` (`ink-50`), not the mock's `ink-38` and `ink-42`:
  in light, text must reach 4.5:1 from `ink-50` up (decision 88).
- `contr-flow` goes left to right, as the mock does; the layers of `flow.ts` are now columns,
  and the boxes of one layer stack. The limits stay: 6 steps deep, 4 side by side. Back and
  self arrows loop below the boxes, dashed, with the label under the curve.
- Flow marks: done ✓ and dim text; running has the brightest outline (`--ink-60`), `ink-100`
  text and the working glyph (`StatusGlyph` in a `foreignObject`); waiting has the waiting
  glyph; failed ✕. `info` and no state look the same. None is red: red only means "needs you".
- `contr-seq`: a message to `you` or `owner` is red (`--blocked`). The mock names the owner
  `you`; the chat-blocks example names it `owner`. Both mean the owner.
- The rail and the diagrams have no frame: the mock draws them on the answer, as the charts
  (decision 211).
- The mock's box outline `.14` is `--tick`; its lines `.3` are `--ink-30`, arrowheads `--ink-45`.
