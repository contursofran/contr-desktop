# Colors from herdr-contr's themes (#85)

- The theme tokens are herdr-contr's theme files: dark `herdr-app/themes/herdr-contr-mac.json`, light `herdr-contr-mac-light.json` (`colors`, plus `foreground`). The terminal takes `background`, `foreground`, `selection`, `cursor` and `ansi` from the same files.
- `chrome` is the sidebar, the top bar and small control boxes; `canvas` is the work area. This follows the mods `herdr-contr-spaces`, `herdr-contr-tabs` and `herdr-contr`.
- Claude Code and Codex show their own pictures in their own colors: Herdr's program table gives them `tint: false`. Other kinds are one-color glyphs, tinted as the mod does.
- The loader is herdr-contr's braille `loader()` at 80 ms, not Herdr's `spinner.svg`: the herdr-contr layout uses herdr-contr's own tabs and sidebar mods. Its color follows the mod at each place: `working` on a tab, a tool call and a board; `foreground` in the status line and on a sidebar row.
- Two differences from the theme files, by the owner's choice (2026-11-17, #102): in light, `muted` is `#5f5f64` (the file's `#6e6e73` is 4.29:1 on `canvas`) and `dim` is `#6a6a6f` (the file's `#a1a1a6` is 2.18:1). Text in both must reach 4.5:1, and `muted` stays the stronger one:

  | Token | `canvas` | `chrome` | `raised` |
  |---|---|---|---|
  | `muted` `#5f5f64` | 5.37 | 5.82 | 6.35 |
  | `dim` `#6a6a6f` | 4.55 | 4.93 | 5.38 |

  `src/renderer/contrast.test.ts` checks this. The token `faint` keeps the file's pale `#a1a1a6` for marks that are not text (the usage bar, the idle ring) and for inert or disabled controls (New tab, Search, Add machine, the Send button with no text). The dark theme keeps the file's values; there `dim` and `faint` are both `#6a6a6a`.
