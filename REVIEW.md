# Review checklist

The coordinator and each reviewer use this list on a PR. Read it from
`main`, never from the PR under review: a PR must not change the list that
judges it. Run only the items whose trigger matches the diff. Each item
comes from a real miss in this repository.

Each item has three parts:

- Trigger: what in the diff starts the item (paths or a kind of change).
- Check: the command to run or the thing to look at.
- From: the PR, issue or finding behind it.

Paths are in `apps/desktop/` unless they start with `.github/` or
`scripts/`. Run a spec 20 times there, after `pnpm build`:
`pnpm exec playwright test e2e/<spec> --repeat-each 20`. A finding ID
(F, G, H) is from an exploration round.

## Focus, keys and tests that fail at random

1. Focus or keyboard rules
   - Trigger: a change of focus, `tabIndex`, key handlers or card keys
     (`renderer/chat/reply/`, `renderer/chat/card/`,
     `renderer/chat/owner/`, `renderer/App.tsx`, `renderer/topbar/`).
   - Check: run `Focus.browser.test.tsx`, `attach.spec.ts`, `topbar.spec.ts`,
     `small-texts.spec.ts`, `cards.spec.ts` and `Keys.browser.test.tsx` (run `pnpm test:browser Focus.browser.test.tsx Keys.browser.test.tsx` in a fresh process each time) 20 times
     each. All runs pass.
   - From: #155 (three specs then failed at random).
2. A new or changed e2e spec
   - Trigger: a new spec, or a spec with new waits on scroll, focus, a
     poll or the order of rows.
   - Check: run that spec 20 times. All runs pass.
   - From: #82, #92 (fixed in #107), #130 (the `inbox.spec.ts` order
     race).

## Layout

3. The chat column, the list or the reply area
   - Trigger: a change of `renderer/chat/list/`, `renderer/chat/reply/`,
     a width class (`max-w-*`) or `scrollbar-gutter`.
   - Check: `Column.browser.test.tsx` and `Jump.browser.test.tsx` pass; they force a 15 px
     classic scrollbar, as on the CI runner. On macOS also look at a
     screenshot with the overlay scrollbar. The rows, the status line and
     the reply box have the same edges.
   - From: #123, #137 (H19 for the Inbox).
4. The `Chat` block of `App.tsx` or a card
   - Trigger: a change of the `Chat` block of `renderer/App.tsx`,
     `renderer/chat/card/` or `renderer/chat/owner/OwnerCards.tsx`.
   - Check: `StackedCards.browser.test.tsx` passes: three stacked cards at
     640x480 keep the reply box in the window and the chat list visible.
   - From: #139 (H4), fixed in #152.
5. A narrow window
   - Trigger: a visible change in the reply box, the status line, the
     top bar or the cards.
   - Check: screenshots at 640x480 (the minimum window) and 1400x900.
     No text breaks onto two lines or touches the window edge; a cut
     text ends with "…".
   - From: F7, F14 (#105), G5 (#126), G7 (#135).
6. A new color or text color
   - Trigger: a change of the theme tokens in `renderer/index.css`, or
     a text that uses `faint`.
   - Check: `src/renderer/contrast.test.ts` checks the new pair. Text is
     4.5:1 or more in light and dark.
   - From: F10 (#106), G10 (#125).
7. Text from an agent or the owner
   - Trigger: a new element that shows message text
     (`renderer/chat/markdown/`, `renderer/chat/rows/`).
   - Check: it has `dir="auto"`; `Rtl.browser.test.tsx` passes.
   - From: H12 (#147), fixed in #158.

## Main process

8. A new read of hc, the helper or the tool
   - Trigger: a new call in `src/main/` that reads hc, the helper or
     `herdr-contr-orch`.
   - Check: a failed or slow read keeps the last good data and the view
     says why. A test makes one read fail.
   - From: #140 (H1), fixed in #151; #127.
9. A new child process
   - Trigger: a new `spawn` or `execFile` in `src/main/`.
   - Check: the program path comes from its `CONTR_*` switch
     (`CONTR_HC`, `CONTR_GH`, `CONTR_GIT`, ...), so e2e runs the fake.
     `JSON.parse` of its output is in a `try`. Its `stdin` has an `error`
     listener.
   - From: #127 (the attach ran the real `hc`), H11 (#144), fixed in #156.
10. A listener in an IPC handler
    - Trigger: a new `.on(` or `.once(` on a `WebContents` or a window in
      a handler that runs more than once.
    - Check: the listener is added once per `WebContents`. A unit test
      switches agents more than 11 times and sees no
      `MaxListenersExceededWarning`.
    - From: H16 (#142), fixed in #154.
11. A new poll
    - Trigger: a new `setInterval`, a new timer loop, or a shorter
      interval.
    - Check: there is no event to push instead; the code says the
      interval; two reads cannot overlap; the number of processes per
      read does not grow with the number of agents.
    - From: H10, H20 (#145).
12. A new environment switch
    - Trigger: a new `process.env.CONTR_*` read in `src/main/`.
    - Check: it is read only when `CONTR_E2E=1`, or the PR says why the
      packaged app needs it.
    - From: #146 (H13: `CONTR_UPDATE_URL` is read in each run).
13. A new link or window
    - Trigger: a new `href`, `window.open` or `BrowserWindow`.
    - Check: a link opens in the system browser (`main/links.ts`);
      `links.spec.ts` passes; the window count stays 1.
    - From: G1 (#111), fixed in #121.

## Releases and the network

14. The release workflow or a release script
    - Trigger: a change of `.github/workflows/release.yml` or
      `scripts/release-notes.mjs` or other release scripts.
    - Check: the `CI` dry run (`node scripts/release-notes.mjs --dry-run`)
      passes and prints the right notes and `release.json`. Then a test
      release is made and deleted after.
    - From: #122, #131.
15. A new URL that the app reads
    - Trigger: a new `fetch` or URL in `src/main/`.
    - Check: it is not `api.github.com` with no token (60 reads in an
      hour); use a release file under `releases/latest/download/`.
    - From: #128, fixed in #131.
