# Change log in Settings (#120)

- The release notes get a `## Changes` part: one line for each commit subject after the release before, newest first. `scripts/release-notes.mjs` writes the notes, not inline shell, so `CI` runs its test and a dry run on each pull request.
- The script and the app read GitHub with the API, not with git history: the compare API gives the commits between the release before and this commit. The `publish` job checks out only `scripts/`.
- The GitHub API lists releases by tag name, not by time (the short sha sorts the releases of one day). The script and the app read up to 100 releases and sort them by `published_at`.
- The app reads the releases with each update check (start, every 6 hours, each open of Settings, Check now, the app menu) and keeps them in memory. No timer of its own. One IPC call, `changeLog(again)`: `again` is Retry.
- A failed read keeps the last good list and shows the message with Retry. Dev and e2e read nothing (no part shows), unless `CONTR_RELEASES_URL` points at a fake list. With `CONTR_E2E=1`, `CONTR_VERSION` replaces the app's version, so a test can mark a release "Installed".
- The design has no change log. The part uses the Settings parts as they are: a `text-xs muted` title and a `raised` card with a `border`. A version in 13 px mono, the date in 11 px mono `muted`, the changes as a list in 12 px. "Installed" is 12 px `muted` text; "New" is the same text with the `working` dot of the foot's Update dot (`working` text on `raised` is under 4.5:1 in light). "Show older" and Retry have the look of Check now.
- `newer` moves to `src/shared/version.ts`: main and the renderer both use it.
- A `(#123)` stays plain text. Links are another issue (#111).
