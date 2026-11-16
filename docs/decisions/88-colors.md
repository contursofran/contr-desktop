# Colors from herdr-contr's themes (#85)

- The theme tokens are herdr-contr's theme files: dark `herdr-app/themes/herdr-contr-mac.json`, light `herdr-contr-mac-light.json` (`colors`, plus `foreground`). The terminal takes `background`, `foreground`, `selection`, `cursor` and `ansi` from the same files.
- `chrome` is the sidebar, the top bar and small control boxes; `canvas` is the work area. This follows the mods `herdr-contr-spaces`, `herdr-contr-tabs` and `herdr-contr`.
- Claude Code and Codex show their own pictures in their own colors: Herdr's program table gives them `tint: false`. Other kinds are one-color glyphs, tinted as the mod does.
- The loader is herdr-contr's braille `loader()` at 80 ms, not Herdr's `spinner.svg`: the herdr-contr layout uses herdr-contr's own tabs and sidebar mods. Its color follows the mod at each place: `working` on a tab, a tool call and a board; `foreground` in the status line and on a sidebar row.
