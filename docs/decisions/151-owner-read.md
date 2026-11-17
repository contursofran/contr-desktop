# 151: A failed read of the owner items keeps the last good list

- The app reads `herdr-contr-orch owner open --json` every 3 s. A read whose run fails (non-zero exit, no answer in 10 s) or whose output is not a JSON list does not mean "nothing is open". The app keeps the last good list: the cards, the Inbox rows, the Inbox count, the window title and the Dock badge do not change, and a typed answer stays in its field.
- While the last read failed, the Inbox shows one line "Cannot read the owner items: <why>" in the Change log's failure look (`text-xs`, `error` token). "Nothing needs you." does not show then. The line goes after the next good read. It has no Retry because the app has no read on demand. The next read comes at most 3 s later.
- When the first read fails, the list is empty, so no cards show. This is the same as the mod's "a tool that is missing or fails gives no cards" (`docs/design/recipe-herdr.md`), and the Inbox also says why.
- `run()` in `main/sidebar/agents.ts` still gives only stdout (it gives "" on failure). `runRead()` also gives why the run failed.
