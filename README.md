# contr-desktop

contr as a desktop app: Electron and TypeScript. It shows coding agents
(Claude Code, Codex) as chats, with cards that answer an agent's prompt or
question, one inbox for what needs the owner, and each orchestrator with its
workers.

It replaces the Herdr mod (herdr-contr) as the place where the owner works,
when it does that job better. Until then, herdr-contr stays the daily app.

## Start here

| Read | For |
|---|---|
| `AGENTS.md` | the goal, the rules and the checks |
| `docs/research/why-electron.md` | why this app exists, and the lessons from the three apps before it |
| `docs/design/README.md` | the design to aim for, with the screenshot and the canvases |
| `docs/reference/helper-protocol.md` | the helper's JSON Lines protocol, that feeds the chat |
| `docs/research/t3code-chat.md` | which parts of t3code to copy, and how |

## The helper

`scripts/fetch-helper` downloads the newest herdr-contr release into `bin/`
(it needs `gh`). The app runs `bin/herdr-contr-feed`, or the program that
`CONTR_HELPER` names, for the terminal that `CONTR_TERMINAL` names (default
`t1`). The reply box takes the terminal's title from `hc get --json` (or the
program that `CONTR_HC` names). Tests use `apps/desktop/e2e/fake-helper.mjs` and
`fake-hc.mjs`.
