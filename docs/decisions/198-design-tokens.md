# The contr design-system tokens in the app (#178)

- `apps/desktop/src/renderer/tokens.css` is a copy of `docs/design/redesign/tokens.css`. Dark is the
  default; light follows `prefers-color-scheme`, which Settings sets through nativeTheme.
- Glass is drawn as opaque fills, as the mocks do: `--win` (window), `--side` (sidebar, reply box) and
  `--float` (raised). Light: the same mix of the light glass over the light ground
  (`#eff0f2`, `#f7f8f9`, `#f9fafb`).
- The Tailwind color names stay, so each part keeps its classes. Each name points at one token:
  `canvas` `--win`, `chrome` `--side`, `raised` `--float`, `border` `--panel-line`, `foreground`
  `--ink-95`, `muted` `--ink-62`, `dim` `--ink-50`, `faint` `--ink-30`. The ink scale is also
  `ink-100` to `ink-26`, and the lines are `hairline`, `rail`, `input-line`.
- State is ink, not color: `working` and `accent` are `--ink-100`, `done` is `--ink-62`. Red
  (`--blocked`) is only "needs you". An error text is `--ink-100`, not red.
- `dim` is `--ink-50`, not `--ink-42` as on some mocks: in light, `--ink-42` and `--ink-45` do not
  reach 4.5:1 on `--win`. `contrast.test.ts` checks text in light on the three fills.
- PR and issue colors stay GitHub's, the one exception to the greys.
- Inter and JetBrains Mono come from `@fontsource-variable` and are bundled; no web fonts. The build keeps the font files as files (`assetsInlineLimit` in `vite.config.ts`): the CSP allows only `'self'`, so a `data:` font does not load.
- The status glyph is one part, `ui/StatusGlyph.tsx`: working ⠋ turns, waiting ⠿ pulses, idle ⠶,
  blocked ⠿ pulses in red. CSS draws the frames, so no timer runs for each row. Reduced motion stops it.
- The terminal takes `--win`, `--terminal-text` and `--ink-95`; its ANSI colors stay herdr-contr's.
- This replaces the colors of decision 88 (herdr-contr's theme files).
