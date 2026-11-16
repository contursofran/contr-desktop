# 49: Sidebar head and foot

- The head's machine switch lists `hc machine ls --json`, without temporary machines. "This computer" is first. The pick does not filter the Projects list yet: the app reads this computer's agents only.
- The foot reads the helper's `usage` at start and every 5 minutes (it has no event). One row per plan with data: the most used window as "41% wk · 4d". A window past its reset is 0%.
- Search, the sidebar toggle, "Add machine…", Settings and + do nothing yet. Issue 16 builds Settings.
