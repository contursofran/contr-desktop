# contr-status and contr-queue blocks (#37)

- A `contr-status` line is `<worker> | #<issue> | <text>`; a `contr-queue` line is `#<n> <label>`, with ` -- <note>`. One bad line keeps the whole block as code.
- Worker state comes from `herdr-contr-orch agents ls --all --json`, read-only. A worker that is not live shows as done. `blocked` and `waiting` show as blocked. Other live states show as idle.
- The PR of a row is the last PR that closes its issue (`closedByPullRequestsReferences`). Its checks are the head commit's `statusCheckRollup`. One batched gh call, cached 60 s per issue.
- The board asks every 10 s while it shows. Main keeps the tool's answer 5 s.
- The design draws no board. The form is the simplest one: a `raised` panel, one row per line, the design's status marks.
