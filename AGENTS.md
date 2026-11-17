# Working on contr-desktop

contr-desktop is contr as an Electron + TypeScript app. It shows coding
agents as chats, answers their prompts with cards, keeps one inbox for the
owner, and shows each orchestrator with its workers.

## Where it comes from (owner, 2026-11-16)

- Three apps came before it: a Rust GPUI app, contr (Go + MyGo), and
  herdr-contr (a Herdr desktop app mod). `docs/research/why-electron.md` says
  what each one taught and why this one is Electron.
- We copy parts of t3code (MIT) into this repository: option A, not a fork.
  We own the copy. There is no upstream remote and no plan to merge from it.
  Each copied file keeps a header that names its source file, and
  `THIRD_PARTY_NOTICES.md` holds t3code's MIT notice.
- We keep what works from herdr-contr, and do not port it again:
  - the helper `herdr-contr-feed` (Rust): session logs, hc, model, usage.
    The app runs it as a child process and talks JSON Lines
    (`docs/reference/helper-protocol.md`).
  - the orchestration tool `herdr-contr-orch` and the Claude Code kit
    (workers, owner questions and to-dos, the MCP tools, hooks).
  - herdr-core (`hc`) owns the terminals. Agents run in hc terminals; this
    app is one more hc client, as the Herdr app is.
  The helper, the tool and the kit are now in contr-core
  (`contursofran/contr-core`), contr's core.
  The binaries come from contr-core's GitHub releases (tag
  `build-YYYY-MM-DD-<sha7>`, a zip with `bin/herdr-contr-feed` and
  `bin/herdr-contr-orch`). A change that the helper needs is an issue in
  contr-core, not a copy of its code here.

## Goal: one thing at a time

Each step is finished and in use before the next one starts.

1. The spike: one agent's chat in an Electron window, fed by the helper,
   with the four measures in `docs/research/why-electron.md`. Then the owner
   decides to go on or to stop.
2. The chat view at the design's level: messages, tool-call chips, code,
   tables, inline PR and issue chips, remarks and contr blocks, cards.
3. The reply box: status line, model and effort menu, context ring.
4. The sidebar: Projects with their agents and workers, the head with the
   machine switch, the foot with the usage bars.
5. The terminal of an agent (xterm.js on an hc terminal), next to the chat.
6. The inbox: the orchestrator's questions and to-dos in one list.
7. Packaging, releases and the Update button. Then the owner moves over.

## Design

The design to aim for is the redesign of 2026-11-17:
`docs/design/redesign/README.md` (issues with the label `redesign`).
Until a part is redone, it follows herdr-contr: `docs/design/README.md`.
Take the colors from theme tokens, dark and light first. Do not invent new
parts; when the design has no answer, ask.

## Checks

- `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm lint`,
  `pnpm test` (unit) and `pnpm e2e` (Playwright on the Electron app, with
  the fake helper). `pnpm dev` runs the app with hot reload. The e2e
  screenshots go to `tmp/shots/`.
- To run, drive and look at the app, use the `verify` skill
  (`.claude/skills/verify/SKILL.md`), not a new launch script;
  `docs/feature-map.md` lists each feature with its keys, selector,
  expected result and spec.
- e2e runs must never show a window, take the owner's focus or input: every spec launches
  through `apps/desktop/e2e/launch.ts` (`CONTR_E2E=1`), and tests use no
  OS-level keys or mouse.
- All must pass, and the `CI` check on the PR, before you report done.
- The first PR sets these scripts up; until then, say which checks exist.
- A test that fails at random: find the cause. Do not run it again to get
  a green check, and add no sleep and no retry. If you cannot find the
  cause, delete the test and write why in the PR.
- A reviewer runs the items of `REVIEW.md` (read from `main`) whose
  trigger matches the diff.

## Design rules (lessons from contr and herdr-contr)

- **See what you build.** A visible change has a Playwright screenshot of
  the real Electron window in the PR. Look at it yourself and check that
  every text on it is the right data, not only the layout. Builders can run
  this app freely: it is not the owner's app.
- **Use the platform.** Inline text, selection, scrolling and focus come from
  the DOM. Do not rebuild them. Copy a tested part from t3code before you
  write a new one.
- **Data comes from hooks, session logs and APIs, not from the screen.** The
  chat takes its data from the helper; workers and owner items from
  `herdr-contr-orch`; terminals from hc.
- **One inbox.** All that needs the owner is in one list. An answer in any
  place closes the item.
- **State comes from the source.** Show what GitHub, hc and the
  orchestration tool say now. No hand-written state file.
- **No file that each PR appends to.** A decision is one file:
  `docs/decisions/<PR number>-<slug>.md`.
- **Push, do not poll, where the source allows it.** Poll only where there is
  no event, and say the interval in the code.

## Safety

- The owner's Herdr app and hc core are live. Never start, stop, restart or
  send input to the owner's `herdr-app` or hc core. Tests use a fake helper
  and a fake hc; an e2e test that needs a real hc starts its own with a
  scratch `HC_SESSION` and stops it after.
- The e2e launcher (`apps/desktop/e2e/launch-env.ts`) gives each run a fake
  hc, helper, orchestration tool, git and gh by default. A program switch
  must name a file in the repository or the temp folder; only its
  `realHcSession` option runs the real hc, on a scratch session.
- Tests use fakes and fixtures. No test reads the owner's session logs
  (`~/.claude`, `~/.codex`) and no test starts the real `claude` program.
- Do not install anything into the owner's Herdr home.

## Workflow

- Work is tracked in GitHub issues and pull requests. One issue, one branch
  `agent/<issue>-<slug>`, one PR into `main`, ideally under about 400
  changed lines (copied t3code files and the lockfile do not count; say how
  many lines are copied).
- Update a branch by merging `main` into it. Never force-push.
- Squash merge. The coordinator merges after CI passes on the exact head. A
  builder does not merge its own PR.
- Docs, comments and commit messages: concise ASD-STE100 Simplified
  Technical English. No `Co-Authored-By`, AI attribution or generated-by
  lines.
- Write no local paths (such as `/Users/...`) in the repository or in commit
  messages. Do not @-mention people.
- Temporary files go in `tmp/`, which git ignores.
- When a change makes a doc wrong, update it in the same PR.
- A PR that changes an assertion of an existing test, a fake or the CI
  workflow says so in its body, with the reason for each. A change must not
  change the check that judges it without a word.
- Each PR body says how the change was verified (unit, e2e, real window,
  screenshot, by hand), or "none". `.github/pull_request_template.md` has
  these lines.
- Report the PR number, the head SHA, the check status, the screenshot path
  and any deviation.
