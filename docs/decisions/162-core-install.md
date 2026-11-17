# 162: The start install of the core (#150, slice S2)

- At start, a root that is not shared with the Herdr app and has no `bin/herdr-contr-feed`, or a build older than the bundle's, gets the bundle's core first: `install --backend --helper <bundle helper> [--orch <bundle tool>]` with `CONTR_HOME=<root>`, in 60 s at most. No question to the owner (owner, Q2 of #150: A).
- After the install the app probes `version` of the home's helper. A pass runs the home. A failed install or a failed probe runs the bundle; the reason ("Core install failed: …" or "The core in this folder does not start. contr runs its own copy.") is kept for Settings > Core.
- The app never installs into `~/.config/contr-core` while `~/.config/contr-backend` or `~/.config/herdr-app/herdr-contr` exists: that folder would change the default root of the Herdr mod, the tool and each agent. It then runs the bundle.
- A shared root gets no write (Q1: only after the owner's press, slice S5). The install writes only into the root.
- e2e: the fake helper's `install` writes only into the temp `CONTR_CORE_HOME`, and each spec checks that each `CONTR_HOME` in its log is in the temp folder.
