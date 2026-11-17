# Releases

## How a release is made

`.github/workflows/release.yml` runs when the `CI` workflow passes on a push
to `main` (or by hand, `workflow_dispatch`). It:

1. Sets the tag `build-<commit date>-<short sha>` (as contr-core does) and the
   app version `0.1.<run number>`.
2. Builds the app in two jobs: macOS (`pnpm dist`, universal `.dmg` and
   `.zip`) and Linux (`pnpm dist:linux`, x86_64 AppImage). Only the macOS
   build uses a macOS runner. The macOS job runs `scripts/check-bundle`, then
   unpacks the `.zip` with `ditto` and runs `codesign --verify --deep` on the
   app. When the check fails, the release fails.
3. Publishes one GitHub release with the files and notes. The file
   names do not change between releases: `contr-mac-universal.dmg`,
   `contr-mac-universal.zip` and `contr-linux-x86_64.AppImage`. The Update
   button finds the `.zip` and the `.dmg` of the newest release by these names.
   The release also has `release.json` (see The release file).

## Release notes

`scripts/release-notes.mjs` writes the notes:

1. `contr 0.1.<run> from <sha>.`: the update check reads the version here.
2. `## Changes`: one `- ` line for each commit after the release before this
   one, up to this release's commit, newest first. Each line is the commit
   subject, which ends with `(#<PR>)`. The release before is the newest
   published `build-*` release. With no release before, the part has the last
   20 subjects. With no commits, there is no `## Changes` part.
3. The lines about the ad-hoc signature (see Signing).

The script reads the releases and the commits with the GitHub API (`gh api`,
the compare API), so the job needs no git history. The API lists releases by
tag name, not by time, so the script sorts them by `published_at`. The `CI`
workflow runs its test (`node --test scripts/release-notes.test.mjs`) and a
dry run (`node scripts/release-notes.mjs --dry-run`) that prints the notes for
the pull request's head.

## The release file

With `--json release.json --assets dist`, `scripts/release-notes.mjs` also
writes `release.json`, and the publish job uploads it with the other files:

```json
{ "schema": 1, "version": "0.1.30", "tag": "build-…", "sha": "…", "date": "<ISO time>",
  "assets": ["contr-linux-x86_64.AppImage", "contr-mac-universal.dmg", "contr-mac-universal.zip"],
  "releases": [{ "version": "0.1.30", "tag": "build-…", "date": "2026-11-18", "changes": ["…"] }] }
```

`assets` are the file names in `dist`. `releases` is the change log of the
newest 10 releases, this one first. The older ones come from the API list
(the workflow has a token), sorted by `published_at`, parsed as the app's
`changelog.ts` does: drafts and releases with no version are left out. The
`CI` dry run prints the file too.

The app reads
`https://github.com/contursofran/contr-desktop/releases/latest/download/release.json`.
GitHub redirects it to the file. It is not under the API's limit of 60 reads in
an hour for one network address (no token). An asset's URL is
`releases/download/<tag>/<name>`. One read gives the newest release and the
change log. When the file is not there (HTTP 404, a release from before #128)
or is not a schema 1 file, the app reads the API as before.

A failed read says what it is: a 403 or 429 with `x-ratelimit-remaining: 0`
gives "GitHub's limit for this network is reached. Try again after HH:MM."
(`x-ratelimit-reset`, local time); no answer at all gives "No network: GitHub
cannot be reached."; else "HTTP <status>".

## The change log in Settings

Settings > Change log, under Updates, shows the newest 10 releases, newest
first: version, date and the lines of `## Changes`. The installed version has
the mark "Installed"; a newer one has the mark "New". The newest 3 are open; the
rest are behind "Show older". A release with no `## Changes` part (each one
before #120) shows its version and date only. The main process takes the
releases of `release.json` with each update check (see The release file);
with no such file it reads `releases?per_page=100` of
contursofran/contr-desktop (no token) and sorts it by `published_at`. It keeps
the result in memory. A failed read shows its message and Retry; Retry reads
`release.json` again. Dev and e2e read nothing, unless `CONTR_RELEASE_FILE_URL`
or `CONTR_RELEASES_URL` points at a fake file or list (e2e).

The workflow reads the releases of contr-core, a public repository, with
its own token. It needs no secret.

## Where the binaries come from

`scripts/fetch-helper` downloads the newest `build-*` release of
contr-core that is not a prerelease, and puts:

- `herdr-contr-feed` and `herdr-contr-orch` (macOS universal) in `bin/`;
- the Linux x86_64 helper in `bin/linux-x64/`;
- the release tag in `bin/RELEASE`.

`apps/desktop/electron-builder.yml` copies them into the app's
`Resources/bin`. The packaged app finds them there (`binPath` in
`apps/desktop/src/main/helper/binPath.ts`). In dev and e2e the app uses `bin/` at
the repository root. `CONTR_HELPER` and `CONTR_ORCH` override both.

contr-core releases have no Linux `herdr-contr-orch`, so the AppImage has
only the helper.

The `CI` workflow runs the test of `scripts/fetch-helper`
(`node --test scripts/fetch-helper.test.mjs`) with a fake `gh` and a fake
zip; it reads no real release.

## Name

The app is `contr.app`. It replaces the older Go contr app of the same name
(owner decision, D102). Remove a `contr` command link that points into the
old app, such as `~/.local/bin/contr`: the old Claude Code plugin ran
`contr hook stop`, and the new app is not a command-line tool.

## Signing

There is no Apple certificate (owner decision, D97): the app is ad-hoc
signed (`mac.identity: "-"` in `apps/desktop/electron-builder.yml`) and not
notarized. electron-builder signs the whole universal bundle after the merge,
so the app in the `.zip` and the `.dmg` passes `codesign --verify --deep`. The
Update button needs this (#87). The hardened runtime is off: with an ad-hoc
signature it needs an extra entitlement, and only notarization needs it. The
first time, open it with right-click > Open
(or run `xattr -dr com.apple.quarantine /Applications/contr.app`). The
release notes say this too.

Squirrel.Mac and electron-updater need an app signed with a certificate, so the Update button
installs the new app with its own swap script (see The Update button).

## Build locally

```sh
scripts/fetch-helper
pnpm dist               # apps/desktop/release/
scripts/check-bundle    # both binaries are there and herdr-contr-orch runs
```

To check the signature as the release does: unpack
`apps/desktop/release/contr-mac-universal.zip` with `ditto -x -k` into a temp
folder and run `codesign --verify --deep --strict --verbose=2` on its
`contr.app`.

## The Update button

Settings > Updates shows this app's version and the newest release's version.
A packaged app reads `release.json` of the newest release (see The release
file; else `releases/latest` of the API) at start, every 6 hours, each time the Settings view opens, on
"Check now" in Settings > Updates and on "Check for Updates…" in the macOS
app menu (it also opens Settings). One check runs at a time. While it runs,
"Check now" says "Checking…"; after it, Settings shows "Up to date" or the
newest version, and "Checked just now" or "Checked 5m ago". The version comes
from the release notes ("contr 0.1.<run> from <sha>."), because the tag holds
no version. When the newest one is newer, Settings shows an Update button and
the foot's Settings button a dot. A check while a download runs or a new app
is ready keeps that download: a newer release does not replace the ready app.

When the folder of the running `contr.app` is writable and the release has
`contr-mac-universal.zip`, a press downloads the `.zip` with progress and
unpacks it with `ditto` into a temp folder. The app checks that the
`Info.plist` version is the release version and that `codesign --verify`
passes (ad-hoc is fine). Then Settings shows "Restart to update". A press
starts a detached swap script and quits. The script waits for the app's pid
to end, moves the old app to `contr.app.old`, copies the new one in, removes
quarantine (`xattr -dr com.apple.quarantine`) and opens it. It removes the old
copy only after the new app runs. On any failure it puts the old app back and
opens it.

When the folder is not writable or the release has no `.zip`, a press
downloads the `.dmg` into Downloads and opens it; the owner drags contr to
Applications. Settings then says "Opened contr-mac-universal.dmg. Drag contr
to Applications." (the file name, not its folder); the next check that takes a
release removes that line. A failed check or download shows its message. After
a failed check, Settings shows the failure in place of "Checked …", the last
known version (never "Up to date") or "Unknown" when no check passed yet, and
the Update button of a release that a passed check found. A new check hides
the old failure while it runs. `renderer/settings/updateView.ts` holds these
states.

Dev and e2e builds show "Development build" and check nothing. The e2e test of
the `.zip` install builds its `.zip` with electron-builder and
`electron-builder.yml`, so a change to the signing options shows there. e2e tests set
`CONTR_UPDATE_URL` (a fake API release JSON), `CONTR_RELEASE_FILE_URL` (a
fake `release.json`; with no such switch e2e reads no release file) and `CONTR_DOWNLOADS` (a scratch
folder) and `CONTR_INSTALL_DIR` (a scratch folder in place of the running
app's folder, never `/Applications`); with `CONTR_E2E=1` nothing is opened,
swapped or quit.

## PATH in the packaged app

An app opened from Finder or the Dock gets the short macOS PATH. At start, the packaged app (not dev, not e2e) reads PATH from the login shell (`$SHELL -ilc`, or `/bin/zsh`, 3 s timeout), puts it first, keeps the current PATH, and adds `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin`. So it finds `hc` and `gh`. It logs the result once (`contr: PATH=...`). Code: `apps/desktop/src/main/shell/path.ts`.
