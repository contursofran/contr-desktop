# The board with the step of each worker (#189)

- A worker's step comes only from the orchestration tool and gh (`chat/blocks/steps.ts`):
  - tool: `status` blocked makes the step red with "asks you"; `role` gives plan
    (`planner*`), build (`builder*`) and review (`reviewer*`).
  - gh: a PR is the PR step; running or failed checks are the CI step; merged
    and closed end the row.
  - Checks that pass with no reviewer prove no next step. The row shows
    "CI passed" with no step now. contursofran/contr-core#23 asks for a `step`
    field.
- The tool gives no start time, so the row has no run time (contr-core#23).
- A worker that asks the owner shows its open item in place of its PR: the
  item of this chat whose `from` is the worker's name (`from` is "the worker,
  issue or PR it is about"). contr-core#23 asks for a `worker` field.
- No PR: the issue chip, as on the real-work page.
- The one-line form shows when the agent writes `contr-status same`: the app
  cannot compare boards, because the chat draws its rows in a virtual list
  and a board shows live data, not the data of its time.
- The mock's done glyph (⠿ in ink-42, still) is drawn in the board: the status
  glyph has no done state. Text is ink-50 and up (light contrast); the mock's
  ink-38 and ink-45 texts use `text-dim`.
