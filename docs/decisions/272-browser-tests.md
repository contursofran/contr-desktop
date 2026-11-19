# Run renderer tests in Chromium

Use `pnpm test:browser` for tests of the renderer's DOM, layout, theme tokens,
keyboard input and focus. Name the files `*.browser.test.tsx`. Mount the
renderer with a typed fake of `window.contr` and use the same fixture data
as the Electron tests where possible. Chromium runs headless. The tests
can change the viewport and color scheme without a native window.

Use Electron when the test must check a native window, the preload and
main-process IPC path, hc, local image protocol, restart, update or install.
Keep an Electron test that exercises the bridge when moving renderer
assertions to Chromium. If a spec covers both, move the renderer cases
and keep the IPC cases in Electron. Start Electron through
`apps/desktop/e2e/launch.ts`.

`pnpm test` still runs the unit project. CI runs both test projects and the
Electron suite. The Chromium screenshots go to `tmp/shots/browser/`.
