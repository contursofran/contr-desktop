# 46: Sidebar Projects list and the selected agent

- The chat shows one agent at a time: the selected one. Main keeps the selection; `CONTR_TERMINAL` is the first selection. A switch mounts the chat again, so the feed, title, reply box and terminal start for the new agent.
- Agents come from `hc ls --json`. A live terminal with a `status` is an agent; a shell has none and does not show. A terminal goes under its hc `parent`.
- Workers' names and titles come from `herdr-contr-orch agents ls --all --json`.
- The project is the checkout of the cwd's git common dir: a worktree shows under its checkout.
- Updates: `hc events --json` (push), one read per 500 ms burst. Without hc events, a poll every 10 s.
- Icons, age, favicon, branch and the menu: issue 45.
