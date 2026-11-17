# Hide sidebar: a plain hide, and the toggle in the top bar

- Issue 97 (F2). The design has two answers for where the toggle sits while the sidebar is hidden:
  herdr-contr-own puts a 28 px sidebar button right of the window buttons in the top bar; the
  herdr-contr layout uses Herdr's own sidebar and ⌘B. This app does the plain hide and show, not the
  floating sidebar.
- With the sidebar hidden, the top bar starts with "Show sidebar" (the head toggle's look: 28 px
  square, 8 px corners, 16 px icon, `muted`). On macOS the bar pads 76 px at the left for the window
  buttons, as the sidebar head does.
- The state is kept in localStorage `sidebar.hidden`, as the open tabs are in `tabs.open`.
- Open: ⌘B, and the floating sidebar at the left edge (recipe-herdr.md, Sidebar).
