# 43: Orchestrating text and board matching

- The chat's agent is the hc terminal in CONTR_TERMINAL. Its workers are the
  `herdr-contr-orch agents ls --all --json` entries whose `parent` is that
  address.
- The status line shows "Orchestrating · N workers" when N live workers
  exist. With none, a Claude Code agent shows a quiet "Orchestrate" (#47).
- The `contr-status` board matches a row by name and parent. A name with no
  entry under the agent falls back to the name only.
