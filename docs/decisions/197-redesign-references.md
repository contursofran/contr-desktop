# The redesign references are in the repository (#196)

- The owner approved the redesign of 2026-11-17 as the first version and
  asked to save it, with the references and the design system, for later work.
- The mocks are copies of the live pages, as static HTML in
  `docs/design/redesign/`. A builder reads them with no access to the
  owner's private pages.
- `tokens.css` is a copy of the contr design system's tokens. The app takes
  them in #178; until then, the app keeps its present theme (decision 88).
- The real-work page stays only a private link: it shows a session of
  another project. The project name in `chat-screen.html` is changed to
  `sample-game` for the same reason.
- The work is 18 issues with the label `redesign` (#178 to #195) and one
  contr-core issue for the chat-writing skill (contursofran/contr-core#17).
- AGENTS.md now names the redesign as the design to aim for.
  `docs/design/README.md` stays the reference for the parts not redone yet.
