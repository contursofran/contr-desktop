---
name: verify
description: Starts the contr-desktop app hidden with the fakes, drives it and takes screenshots, with one command per call. Use it before you commit a visible or behavior change, and when you are asked to run, check or explore the app. Do not write a new launch script.
---

# Verify the app

The script is `apps/desktop/e2e/verify.ts`. It builds the app when `src/` is newer than `out/`, starts it through
`e2e/launch.ts` (`CONTR_E2E=1`: the window never shows), keeps it in a background process, and runs one command for
each call. Run it from the repository root:

```sh
node apps/desktop/e2e/verify.ts start size=1200x800
node apps/desktop/e2e/verify.ts click navigation Projects button "Install health check"
node apps/desktop/e2e/verify.ts shot install-health-check
node apps/desktop/e2e/verify.ts stop
```

`docs/feature-map.md` lists each feature with its keys, its selector and the expected result: use it as the list of
what to try and as the rubric for a screenshot.

## Commands

| Command | What it does |
|---|---|
| `start [KEY=VALUE ...]` | Starts the app. `fixture=<name>` is a session in `e2e/fixtures` (`rtl-session`) or a path; `size=WxH` sets the window size; every other `KEY=VALUE` is an environment switch of the app or a fake (see the head of each `e2e/fake-*.mjs` and of `e2e/launch.ts`). One session at a time. |
| `size WxH` | Sets the window's content size and waits until the page has it. |
| `theme dark\|light` | Sets the page's color scheme (a hidden window does not follow macOS). |
| `press <key> ...` | Presses keys in the page: `Enter`, `Tab`, `1`, `Alt+ArrowRight`, `Meta+a`. |
| `type <text>` | Types text in the focused element. |
| `click <role> [name] ...` | Clicks the element. Each role and name pair is inside the pair before it. The name is a substring, case does not matter. The role `label` finds by aria-label, `text` by text. One match only. |
| `text [<role> [name] ...]` | Prints the element's text (no pair: the whole page). |
| `roles [<role> [name] ...]` | Prints the ARIA tree of the element: roles, names, states. |
| `title` | Prints the window title. |
| `shot <name>` | Saves a screenshot to `tmp/shots/<name>.png` and prints its path. Look at it: check each text, not only the layout. |
| `log` | Prints the main process's output and the page's console. |
| `stop` | Closes the app and removes its data folder. |

With no switches, `start` gives the chat of `t7` ("Chat panel usability audit", an orchestrator with three workers)
from `fixtures/claude-session.jsonl`, the agents and machines of `fake-hc.mjs`, the workers of `fake-orch.mjs`, the
branch `main` and the plan usage. Sends go to `send.log` and opened links to `open.log` in the session's data folder.
A session that gets no command for 30 minutes stops by itself. When `start` says a session runs and none does, delete
`tmp/verify/session.json`; the background process writes its errors to `tmp/verify/serve.log`.

## Rules

- No window may show and nothing may take the owner's focus: start the app only through this script or
  `e2e/launch.ts`. Use the page's keys and clicks only, never OS-level keys or mouse (no `osascript`, `cliclick` or
  `xdotool`).
- Only the fakes: `CONTR_HELPER`, `CONTR_HC`, `CONTR_ORCH`, `CONTR_GIT` and `CONTR_GH` are always fakes in `e2e/` or
  your own fakes in `tmp/`; the script refuses any other program.
- Never touch the owner's hc core, Herdr app, session logs (`~/.claude`, `~/.codex`) or installed contr app. Do not
  start, stop or send input to them.
- Run `stop` when you are done.
