# Settings as groups of rows (#187)

- Settings follows screen 6 of `docs/design/redesign/screens.html`: a group head, then rows between
  hairlines. The label is on the left in `ink-85`; the value is on the right in mono 11.5 px, `muted`,
  at most 420 px wide. The theme switch is the mock's segmented control.
- The parts are in `settings/rows.tsx`: `Group`, `Row`, `Value`, `PathValue` and `buttonClass`
  (the mock's `.btn`; the primary one, Update and Restart to update, is `.btn.is-primary`).
- A path is cut from the left (`dir="rtl"` on the value, the path in an `ltr` isolate), so the file
  name shows and the home folder does not. The text and the tooltip keep the whole path.
  `ui/PathText.tsx` (the helper error block) is not changed.
- Check now and the last check go in the group head of Updates and Core, as the mock's Health check
  head has them. The progress bar, the status and the error are rows under Newest.
- The group heads are `dim` (`--ink-50`), not `--ink-45` as on the mock, and the last check is
  `dim`, not `--ink-38`: in light, these do not reach 4.5:1 (decision 198).
- The change log has no mock. It is a group of rows too: one release for each row, with its
  version, mark, date and its lines.
