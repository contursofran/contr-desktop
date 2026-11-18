# 55: Sidebar agent icons and age

- The agent icon comes from hc's `agent` kind: `claude-code` and `codex` have LobeHub's icons from `@lobehub/icons-static-svg` 1.102.0 (MIT), `claudecode-color.svg` and `codex-color.svg`, copied byte for byte with a header that names the source file and version. The notice is in `THIRD_PARTY_NOTICES.md`. Another kind shows the Lucide bot, as Herdr's `agent.svg` does.
- The Claude glyph takes the state's color (muted when idle). The Codex icon uses a gradient, so it keeps its own colors.
- The icons are inline SVG: the page's Content-Security-Policy has no `data:` images.
- hc and `herdr-contr-orch` give no time of a state change, so the renderer stamps one, as herdr-contr does: a first sight or a change of state is a stamp. Done and idle count as one. The stamps stay in localStorage (`sidebar.changed`); a stamp of an agent gone for 30 days goes. The ages draw again every 30 s.
- A done agent that is not shown is "not looked at yet": hc turns done into idle when the owner looks. Since #227 the row has no bold for it: an agent row is ink-60, weight 400, as the redesign mock.
- The worker tooltip "name · #issue · work" takes the issue from the orchestration tool's `issue`.
- Each e2e launch has its own scratch user data folder, so no run sees the localStorage of another.
