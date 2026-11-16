# Spike: the four measures and the decision

Issue #8. The measures come from `docs/research/why-electron.md`. The owner
decides to go on or to stop.

## 1. Inline PR and issue chips in one PR: pass

- PR #27 added `#N` chips in agent text, colored by the gh state (open,
  merged, closed, draft, not planned), in paragraphs, list items and table
  cells. Links and code stay text.
- It took one PR and zero fix rounds. herdr-contr needed seven PRs for the
  same part (#63 to #84 there).
- Open work: issue #23 (tool chips and status line at the design's level).

## 2. Builders take screenshots of the real Electron window: pass

- Every spike PR (#18, #19, #20, #21, #22, #26, #27) has Playwright
  screenshots of the real Electron window, with the fake helper, fake hc and
  fake gh. No builder used the owner's apps.
- First problem: each e2e run showed the window in front and took the
  owner's focus. PR #25 fixed it: `e2e/launch.ts` sets `CONTR_E2E=1`, and the
  app then uses the macOS `accessory` activation policy and
  `showInactive()`. A poll of the frontmost app during `pnpm e2e` showed the
  app was never in front.
- Second problem (fixed in #27): two Playwright workers downloaded the
  Electron binary at the same time. `pnpm e2e` now gets it once first.

## 3. The terminal next to Herdr's: partly checked, owner must try it

Checked by a test (PR #20, against a scratch hc core, local only):

- Attach with history, keys and paste go to hc, resize goes to hc.
- Keys typed before the attach completes are not lost.
- `top` draws correctly on the alternate screen, also after a resize
  (screenshot).

Not checked:

- CI has no hc, so the terminal e2e test skips in CI.
- Cmd+C to the clipboard. The app has no menu with a Copy role yet, so
  Cmd+C can fail.
- Claude Code itself as the TUI. Tests must not start `claude`.
- Scroll feel, font match with Herdr (no pixel compare), credit flow
  control, reattach after hc restarts.

Steps for the owner (on a live agent):

1. In the repository: `pnpm install --frozen-lockfile`.
2. Run `hc list` and pick the terminal of an agent, for example `t3`.
3. Run `CONTR_TERMINAL=t3 pnpm dev`. The app attaches to that terminal.
   Without `CONTR_HELPER`, the app runs the real helper from the herdr-contr
   release.
4. Compare with Herdr: scroll, select, Cmd+C, resize the window, look at
   Claude Code's screen.
5. CAUTION: the app is a full hc client. A key typed in the Terminal side
   or a message sent from the reply box goes to the live agent. To stay read
   only, do not type in the terminal and do not send from the reply box.

## 4. Memory and start time: measured

Method (repeat it with the same steps):

1. `pnpm build`.
2. `node apps/desktop/scripts/measure.ts [fixture]` (Node 24 runs the
   TypeScript file). The script launches through `e2e/launch.ts`
   (`CONTR_E2E=1`, no focus) with the fake helper and fake hc.
3. It records the time to the first window (`domcontentloaded`) and to the
   first chat row, waits 30 s idle, then sums the RSS from `ps` of the main
   process and all its children (renderer, GPU, utility). The sum also
   holds a fake helper or fake hc process when one runs (4 to 5 processes).
   The real helper is a small Rust process (about 10 to 80 MB in `ps`).
4. The long chat: the 17-row fixture repeated with new ids to 2000 rows,
   written to `tmp/` (not in the repository).

Results on the owner's Mac (Apple Silicon, macOS 26), three runs each:

| Chat | First window | Rows shown | RSS after 30 s idle |
|---|---|---|---|
| 17 rows | 236–442 ms | 310–570 ms | 428–436 MB |
| 2000 rows | 241–486 ms | 569–1069 ms | 560–612 MB |

- The first cold run after the build took 7.2 s to the window and 11.1 s
  to the rows (disk cache and macOS first-launch checks). The later runs are
  warm.
- The chat list has no virtualization. All 2000 rows are in the DOM.

Rough comparison with Herdr (read from `ps` only, not a like-for-like test):
the running Herdr app had 146 MB RSS, plus 5 MB for its herdr-core child,
after about 2 hours with the owner's real agents. The Electron app uses about
three times that, before a sidebar, an inbox or more than one chat.

## Better and worse than herdr-contr

Better:

- Speed of work. The chips took one PR, not seven. Markdown, code blocks and
  tables were copied from t3code (#26) and worked at once.
- Text from the DOM: selection, copy, scroll and focus come with the
  platform.
- Builders see what they build: real screenshots in each PR, without the
  owner's apps.
- Start time is short when warm (under 0.6 s to rows).

Worse:

- Memory: about 430 MB idle against about 150 MB for Herdr. A long chat adds
  about 150 MB; it needs virtualization later.
- The terminal is not proven next to Herdr's: copy and the Claude Code TUI
  are not checked.
- One more app to package, sign and update (step 7), and a large
  dependency (Electron) to keep current.

## Recommendation: go on

The two reasons for the move (inline parts in one PR, and builders who can
see the window) passed clearly. Memory is the cost, and it is known and
bounded. Go on, with two conditions:

- The owner tries the terminal by hand first (steps above). If it is worse
  than Herdr's, keep the terminal in Herdr and use this app for the chat.
- Add list virtualization before a real long session is the daily case.
