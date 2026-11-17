# 165: Settings > Core with the check and the dot (#150, slice S3)

- Settings has a part "Core" under Updates and above Change log, with the same look and texts (`UpdateCard`, `updateView` with `kind` "core"): Version, Newest with Update, Folder, the last check and the error. The foot's Settings button has the dot when the app or the core has an update.
- The source is the helper's `update check` with `CONTR_HOME=<root>`. The app reads no GitHub API for the core. The check runs at start and at each open of Settings with no `--force` (the core keeps its answer for a day), and with `--force` on Check now and every 6 hours.
- Version and Newest take `installed_version` and `newest_version`, and Update takes `newer`, when the core gives them (contr-core issue C2); else the build stamps and `differs`.
- With no root (dev, e2e with no `CONTR_CORE_HOME`) the part says "Development build". A root shared with the Herdr app is not checked; the part says "The Herdr app uses this core. contr runs its own copy and does not change this folder." and Newest says "Unknown".
- A failed check says "Core check failed: <message>"; `no-gh` and `gh` say "GitHub CLI (gh) is not installed or not logged in.". A failed start install or a home that does not start shows its text until a check fails.
- The Update button has no action yet: slice S4 adds `update install`.
