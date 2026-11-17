# 154: Helper calls

- `commands`: main keeps a terminal's answer only when it has no `error`
  line. After an error, the next reply box read asks the helper again.
- `select("")`: closing the last tab selects no agent. Main stops each
  feed, with its `working` and `card` reads. A feed-ready signal with no
  agent starts nothing.
- Main adds one `destroyed` listener per window for the feed and one for
  the terminal attach, not one per chat mount or attach.
- A value that starts with "-" (finding H14) needs no change. The helper
  (`herdr-contr-feed`, contr-core `xplat/herdr-contr-feed/src/cli.rs`)
  takes the word after an exact `--text`, `--request` or `--answers` as the
  value, whatever it starts with. It does not read `--text=<value>`: that
  form gives "send needs --text <s>". The orchestration tool
  (`xplat/herdr-contr-orch/src/cli.rs`, `owner answer`) joins all words
  after the id as the answer, with no flag parse: a `--` there would be
  saved as part of the answer. The unit tests keep the argument lists in
  this form.
