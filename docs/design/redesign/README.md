# The redesign (2026-11-17)

The owner approved this design as the first version on 2026-11-17. It keeps
Herdr's layout (sidebar, tab bar, chat, reply box) and takes its look from
the contr design system: greys and an ink scale, braille status glyphs, Inter
and JetBrains Mono. The work is in the issues with the label `redesign`.

## Files

| File | What it holds |
|---|---|
| `chat-screen.html` | One screen: the sidebar, the tab bar, a coordinator's chat, the status line and the reply box. The base of the other pages |
| `screens.html` | Each screen of the app, with a screenshot of `main` next to it: chat with blocks, question card, remarks, Inbox, terminal, Settings |
| `rich-parts.html` | One coordinator answer with the rich parts, then each part alone with "Shows", "Data from" and "Agent writes" |
| `tokens.css` | The tokens of the contr design system, dark and light |
| `shots/` | The screenshots of `main` that `screens.html` shows |

Open an HTML file in a browser. The fonts come from Google Fonts; with no
network, the page falls back to the system fonts.

## Live pages

These pages are private to the owner. The real-work page shows a session of
another project, so it has no copy here.

| Page | Link |
|---|---|
| Chat screen | https://claude.ai/artifact/AWV9nQ9ZL3LEb7Ln1GkLc7 |
| Every screen | https://claude.ai/artifact/9CZFjdVSqdg1ZWFuvj51pm |
| Rich parts | https://claude.ai/artifact/3P6ht57Hxd8CFT9vv3AjmJ |
| Real work: a coordinator's session in the new chat | https://claude.ai/artifact/LJAYY6Tf1bPmCfjSckP9Lo |
| contr design system (tokens and parts) | https://claude.ai/artifact/45Kp6p9DoVg3iEMx9Qh7QH |

## The owner's decisions

- Keep Herdr's layout. Take the look from the contr design system.
- Minimal: greys and ink. State shows by glyphs and icons, not by color.
- Red (`--blocked`) is only for "needs you": a blocked agent, an owner item,
  "Decision needed".
- Claude's icon is the pet (`apps/desktop/src/renderer/sidebar/icons/claude.svg`)
  in `--claude`, in the sidebar, the tabs and the model menu.
- PR and issue chips are the one exception to the greys: their icon and a
  faint outline take the app's theme tokens `--color-pr-*` and
  `--color-issue-*`, so open, merged and closed show at a glance. The number
  stays in ink.
- The question card (permissions, questions, pick-any) has the reply box's
  fill and line (`--side`, `--input-line`) and no shadow, so it is part of
  the window, not a panel on top of it.
- The rich parts are approved as parts. The real-work page is the model of
  how they mix in a normal coordinator session: what was recorded as rows,
  what is open for the owner, a board only when it changed, one line when
  nothing changed.

## Open questions for the owner

Do not build these until the owner answers:

1. A closed PR: red as on GitHub, or grey, so that red only means "needs
   you"? (#188)
2. Files and Changes on the right of the tab bar: keep them or not? (#180)
3. The selected sidebar row: Herdr's grey fill, or the design system's rule
   (no fill, brighter text)? (#179)

## Rules for builders

- The data on the mocks are examples. The app shows what the sources say
  now: the helper, hc, the orchestration tool, git and gh.
- Use tokens only. The mocks draw glass as opaque fills: `--win` and
  `--side` are set at the head of `chat-screen.html`, not in `tokens.css`.
  In light, text must still reach 4.5:1
  (`src/renderer/contrast.test.ts`, decision 88).
- A new chat block that agents write needs the skill change in contr-core
  (contursofran/contr-core#17), after the app draws it.
- Each PR has a screenshot of the real window, dark and light.

## Issues

| Issue | Part |
|---|---|
| #178 | The tokens in the app; the status glyph. Do it first |
| #179 | Sidebar |
| #180 | Tab bar and the Chat or Terminal switch |
| #181 | Reply box and status line |
| #182 | One question card |
| #183 | Remarks, code, tables, images, links, the owner's messages |
| #184 | Tool calls in one line, the answer footer, the compaction line |
| #185 | Inbox |
| #186 | Terminal and the hc-ended notice |
| #187 | Settings |
| #188 | Chips with state icons and colors |
| #189 | Board with the step of each worker |
| #190 | Merge queue rail, flow and sequence diagrams |
| #191 | Recorded and open-for-you rows |
| #192 | Digest |
| #193 | PR card |
| #194 | Timeline of the workers |
| #195 | Bar and line charts |
