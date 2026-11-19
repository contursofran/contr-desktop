# Run only the e2e specs for the change locally

The owner left this choice to the coordinator (2026-11-19).

Locally, a builder runs `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm test:browser`, and only the e2e specs that cover its change:
`pnpm e2e --workers=2 e2e/<spec>.spec.ts`. It runs the checks one after
another. The `CI` check runs the full e2e suite on each PR and is the judge.

Why: several builders run at the same time on one machine. Each full
Electron run started about 166 apps with Playwright's default of four
workers, and the load reached about 85 on 8 cores. After #271 to #282 moved
the renderer-only tests to headless Chromium, CI runs the e2e suite in
138 s, not 624 s. A full local run in each builder repeats that work.

A change to shared parts (the launcher, the fakes, the main process or the
preload) can break specs far from it. Then run the full suite once with
`pnpm e2e --workers=2`, or rely on CI and say so in the PR.
