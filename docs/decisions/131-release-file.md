# Release file for the update check (#128)

- The update check and the change log read `api.github.com` with no token: 60 reads in an hour for one network address, for all programs on it. Past that GitHub answers 403, and the owner saw "Update check failed: HTTP 403".
- Each release now has `release.json` (`scripts/release-notes.mjs --json`). The app reads it from `releases/latest/download/release.json`, which is not under the API limit. One read gives the newest version, the asset names and the change log of the newest 10 releases.
- The asset URLs are `releases/download/<tag>/<name>`, made from the file's URL, so a fake server in e2e serves them too.
- The workflow, not the app, reads the older releases with the API: it has a token. The script parses them as `changelog.ts` does (a copy of `versionOf` and `parseChanges`, because scripts run with no build).
- HTTP 404 (a release from before this change) or a file that is not schema 1: the app reads the API as before. Other failures show their text and do not fall back, so a limit is not hit twice.
- Failure texts come from the main process, which has the headers: the rate limit with its reset time (local HH:MM), no network, else "HTTP <status>".
- `CONTR_RELEASE_FILE_URL` points the check at a fake file (e2e). With no such switch, e2e reads no file, so the existing tests run the API path as before.
