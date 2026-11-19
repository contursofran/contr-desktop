# New tab menu (PR 265)

- The + button and ⌘T open the same menu. Claude Code has focus first, followed by Codex and Shell.
- Start the program with `hc run --bg --json --no-parent`. Use the selected agent's session folder, the first project's folder, or home if no folder is available. Shell passes no program to hc.
- Select the returned terminal at the end of the tab row and save it in `tabs.open`. Shell opens in the Terminal view. If hc fails, show its reason and keep the current tab.
