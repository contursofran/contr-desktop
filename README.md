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
| `docs/reference/releases.md` | how a release is made and where its binaries come from |
| `docs/research/t3code-chat.md` | which parts of t3code to copy, and how |

## The helper

`scripts/fetch-helper` downloads the newest herdr-contr release into `bin/`
(it needs `gh`). In dev the app runs `bin/herdr-contr-feed`; the packaged
app runs the copy in its `Resources/bin`. `CONTR_HELPER` names another
program. At start it shows the agent shown before the restart while hc lists
it, else the one that `CONTR_TERMINAL` names, else the first agent in the
sidebar. The reply box takes the terminal's title from `hc get --json` (or the
program that `CONTR_HC` names). Tests use `apps/desktop/e2e/fake-helper.mjs` and
`fake-hc.mjs`.
The Terminal side shows the same terminal through hc, in the hc session that
`CONTR_HC_SESSION` names (default: hc's own).
