# Links in a message (#111)

- An agent writes the message text, so a link in it can hold any URL. `src/main/links.ts` guards each web contents of the app (`web-contents-created`):
  - `setWindowOpenHandler` always answers `deny`. The app opens no second window.
  - `will-navigate` and `will-redirect` to a URL other than the app page are stopped. A reload, a hash change and the first load go on.
  - In both cases the URL goes to the system (`shell.openExternal`) only when its scheme is `http:`, `https:` or `mailto:`, and it is not on the app's own origin (a relative path in `pnpm dev`). `file:`, `javascript:`, `data:` and custom schemes open nothing.
- A link to a local path (`notes/plan.md`, `/tmp/plan.md`) becomes a `file:` URL and opens nothing. It still looks like a link. How it should show, and if a click should open the file, is a question for the owner.
- The PR and issue chips keep their own rule (`https:` only, through `openRef`). Both use one opener: with `CONTR_E2E=1` it writes the URL to `CONTR_OPEN_LOG` and opens nothing.
