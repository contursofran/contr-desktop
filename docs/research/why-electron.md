# Why Electron (owner, 2026-11-16)

## The apps before this one

| App | Stack | What it taught |
|---|---|---|
| contr GPUI | Rust, GPUI | A native GPU UI is fast, but every part of a chat (text flow, selection, scrolling) is hand work |
| contr | Go, MyGo | The orchestration (workers, the owner's questions and to-dos, the flow) and its rules. It moved to herdr-contr |
| herdr-contr | Herdr desktop app mod (JavaScript on gpui-kit), Rust helper | Herdr gives the terminal, tabs and sidebar for free. The chat stays hard |

## Why the chat was hard in herdr-contr

1. **No inline layout.** gpui-kit has no DOM. Text cannot flow around an
   element in a paragraph. Inline PR icons took seven PRs (herdr-contr #63 to
   #84): a paragraph became one element per word in a wrapping row, with the
   word gap (0.22 em) and the line height set by hand. Selection across those
   parts is still worse than in plain text.
2. **Builders could not see the screen.** One Herdr app runs per Mac, and it
   is the owner's. Builders tested against a hand-written stub of Herdr's API
   that checks the element tree, not pixels. The first look was after the
   merge, so each visual fix cost a full PR.
3. **One process for each helper call** (40 to 80 ms each), so the chat polled
   every 2 s, and every 1 s while an agent works. The model button went
   stale (herdr-contr #208).
4. **State from many sources** (session log, hc status, the owner's typing),
   each on its own clock. The model menu bugs came from that (herdr-contr
   #208, #209).
5. **Herdr's API moves fast** (0.1.14 to 0.1.16 in six days), and our copies
   of its mods drift (herdr-contr #224).

## What Electron gives

| Pain | In Electron |
|---|---|
| Inline icons | A `<span>` in text. Wrapping and selection come from the browser |
| No screen for builders | Playwright drives the real Electron window and takes screenshots. Builders run the app as much as they want |
| A stub of the UI API | Tests run in a real Chromium |
| Models know GPUI and Herdr's API badly | TypeScript, React, HTML and CSS are what models know best |
| Every chat part written by hand | t3code (MIT) has a tested chat: Markdown pipeline, code blocks, tables, link chips, PR icons |

## Why not Tauri

- We copy from an Electron app. t3code's chat targets Chromium.
- Chromium on every OS. Tauri uses the system web view, and WebKitGTK on
  Linux is the weak one; the owner works on two computers.
- Playwright drives Electron directly.
- Tauri's two strengths matter less here: size, and Rust in the same
  process. The helper already runs as a separate process.

## What it costs

- We lose what Herdr draws: the terminal, tabs, windows, keys and themes.
  The terminal is the biggest one: xterm.js on an hc terminal must feel good
  enough.
- More memory (about 150 to 300 MB) and a less native feel.
- One more rewrite. The risk: each new platform feels faster until its own
  limits show. The spike measures this before we go on.

## What stays

- The Rust helper (`herdr-contr-feed`) and the orchestration tool
  (`herdr-contr-orch`), from herdr-contr's releases. They hold the logic and
  talk JSON.
- hc owns the terminals. Workers keep running when this app closes.
- The design: `docs/design/README.md`.

## The spike's measures (pass or fail)

1. Inline PR and issue chips in message text, colored by state, in one PR.
2. A builder takes Playwright screenshots of the real Electron window, with
   no access to the owner's apps.
3. A terminal (xterm.js) on an hc terminal next to the chat: how it feels
   next to Herdr's.
4. Memory and start time, measured and written in the PR.

After the spike, the owner decides to go on or to stop.
