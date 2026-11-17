# 59: One rule for an agent's live workers

The status line and the sidebar count an agent's workers with one function,
`liveWorkerParents` in `apps/desktop/src/main/workers/live.ts`.

- A worker is a live hc terminal (state `live`) with a parent. Since #136 it
  needs no `status`: a worker that has just started has none yet.
- When the orchestration tool has an entry for that address, the entry must
  say `live: true`. A tool entry with no hc terminal is not a worker.
- The parent is the tool's `parent`, else hc's `parent`.

An hc terminal with an hc `parent` and no tool entry still counts. This keeps
the sidebar nesting of PR #46.
