# Scope tabs to the selected project

- The selected terminal sets the project. Start with its agents in sidebar
  order, then its other saved terminals. The new-tab button stays last.
- A worker has a tab while its chat shows. Inbox and Settings keep the
  project's tabs and clear selection.
- Save each project's tab order and closed tabs in `tabs.open`. A sidebar
  selection can reopen a closed tab. Keep the saved state during an hc outage.
- Migrate legacy entries as the sidebar supplies membership. A live old
  terminal without membership goes in the last shown or first project. The
  sidebar currently supplies membership for agents and workers.
- Apply tab keys, wheel navigation and reorder to the visible tabs. Close
  ends the hc terminal as in PR 333 and selects a neighbor in the same project.
