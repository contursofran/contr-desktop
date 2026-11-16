# Releases

## How a release is made

`.github/workflows/release.yml` runs when the `CI` workflow passes on a push
to `main` (or by hand, `workflow_dispatch`). It:

1. Sets the tag `build-<commit date>-<short sha>` (as herdr-contr does) and the
   app version `0.1.<run number>`.
2. Builds the app in two jobs: macOS (`pnpm dist`, universal `.dmg` and
   `.zip`) and Linux (`pnpm dist:linux`, x86_64 AppImage). Only the macOS
   build uses a macOS runner. The macOS job runs `scripts/check-bundle`.
3. Publishes one GitHub release with the files and short notes. The file
   names do not change between releases: `contr-mac-universal.dmg`,
   `contr-mac-universal.zip` and `contr-linux-x86_64.AppImage`. The Update
   button finds the `.dmg` of the newest release by this name.

The workflow needs the secret `HERDR_CONTR_TOKEN`: a token that can read
the releases of the private herdr-contr repository.

## Where the binaries come from

`scripts/fetch-helper` downloads the newest `build-*` release of
herdr-contr and puts:

- `herdr-contr-feed` and `herdr-contr-orch` (macOS universal) in `bin/`;
- the Linux x86_64 helper in `bin/linux-x64/`;
- the release tag in `bin/RELEASE`.

`apps/desktop/electron-builder.yml` copies them into the app's
`Resources/bin`. The packaged app finds them there (`binPath` in
`apps/desktop/src/main/helper/binPath.ts`). In dev and e2e the app uses `bin/` at
the repository root. `CONTR_HELPER` and `CONTR_ORCH` override both.

herdr-contr releases have no Linux `herdr-contr-orch`, so the AppImage has
only the helper.

## Signing

The app is not signed and not notarized: there is no Apple certificate
(owner decision, D97). The first time, open it with right-click > Open
(or run `xattr -dr com.apple.quarantine /Applications/contr.app`). The
release notes say this too.

Auto-install (Squirrel.Mac, electron-updater) needs a signed app, so the
Update button only downloads the newest `.dmg` and opens it.

## Build locally

```sh
scripts/fetch-helper
pnpm dist               # apps/desktop/release/
scripts/check-bundle    # both binaries are there and herdr-contr-orch runs
```

## The Update button

Settings > Updates shows this app's version and the newest release's version.
A packaged app reads `releases/latest` of contursofran/contr-desktop (no
token) at start and every 6 hours. The version comes from the release notes
("contr 0.1.<run> from <sha>."), because the tag holds no version. When the
newest one is newer and has `contr-mac-universal.dmg`, Settings shows an
Update button and the foot's Settings button a dot. A press downloads the
`.dmg` into Downloads, with progress, and opens it; the owner drags contr to
Applications. A failed check or download shows its message.

Dev and e2e builds show "Development build" and check nothing. e2e tests set
`CONTR_UPDATE_URL` (a fake release JSON) and `CONTR_DOWNLOADS` (a scratch
folder); with `CONTR_E2E=1` the `.dmg` is not opened.
