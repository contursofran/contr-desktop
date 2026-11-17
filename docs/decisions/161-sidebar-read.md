# 161: The sidebar read runs few processes

- Each read runs one `hc ls --json` and one `herdr-contr-orch agents ls --all --json`.
- `hc get --json` (the title and the session folder) runs only for a terminal that is new, whose `turn`, `status` or `cwd` in `hc ls --json` changed, or that an `hc events` line other than a status line names. The other terminals keep their last answer (a cache by address). A gone terminal drops out of the cache. A failed get is tried again on the next read.
- At most 8 `hc get` run at once.
- git (branch, ahead and behind) runs for a new project, and every 30 s for each shown project. A folder's project (`git rev-parse --git-common-dir`) and favicon stay while the folder shows. A failed `rev-parse` is tried again, except "not a git repository".
- Reads: 500 ms after the last `hc events` line of a burst, 2 s at most after its first line. One read at a time; a refresh during a read starts one more read after it.
- There is no hc poll while `hc events` runs. When it ended, the poll is every 10 s.
