# b-45c: Sidebar project row (Part of #45)

## What changed
- Main: each project has its folder, branch, commits ahead and behind (git) and favicon (the design's file order, no .ico). git has no event, so it is read with each list read and every 30 s.
- Renderer: the project row has the chevron, the favicon or folder, the name, the branch and ↑N ↓N. The chevron shuts a project and the state stays in localStorage `projects.closed`. A shut project shows its agents' marks.
- e2e: the fake git gives the branch and the counts. The spec checks the texts, the shut state, the marks and that a reload keeps it shut.

## PR
- #61, head 6e04a86fff0c0b9719bcd666056231bfcd17dfcd, CI pass. Local typecheck, lint, unit and e2e: all pass.

## Screenshots
- /Users/aerolab/Documents/code/personal/contr-desktop-wt/agent/45-sidebar-rows/tmp/shots/sidebar-dark.png
- /Users/aerolab/Documents/code/personal/contr-desktop-wt/agent/45-sidebar-rows/tmp/shots/sidebar-light.png
- /Users/aerolab/Documents/code/personal/contr-desktop-wt/agent/45-sidebar-rows/tmp/shots/project-shut-dark.png
- /Users/aerolab/Documents/code/personal/contr-desktop-wt/agent/45-sidebar-rows/tmp/shots/project-shut-light.png

## Left (Part of #45)
- The row menu (New tab here, Rename…, Close workspace…) and a click that selects the space. They need spaces, which the app does not have yet.
- The design gives a project row no hover buttons.
- I changed no e2e fixtures, so the coordinator's note about the same title on three agents is not done here.

## Made outside the worktree
nothing
