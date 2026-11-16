# Releases

## How a release is made

`.github/workflows/release.yml` runs when the `CI` workflow passes on a push
to `main` (or by hand, `workflow_dispatch`). It:

1. Sets the tag `build-<commit date>-<short sha>` (as herdr-contr does) and the
   app version `0.1.<run number>`.
2. Builds the app in two jobs: macOS (`pnpm dist`, universal `.dmg` and
   `.zip`) and Linux (`pnpm dist:linux`, x86_64 AppImage). Only the macOS
   build uses a macOS runner. The macOS job runs `scripts/check-bundle`.
3. Publishes one GitHub release with the files and short notes.

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

There is no signing certificate yet. The macOS app is not signed and not
notarized. macOS can block it the first time; run
`xattr -dr com.apple.quarantine /Applications/contr.app`. The release notes
say this too.

Auto-update (electron-updater, the Update button) needs a signed app on
macOS: Squirrel.Mac does not install an update into an unsigned app.

## Build locally

```sh
scripts/fetch-helper
pnpm dist               # apps/desktop/release/
scripts/check-bundle    # both binaries are there and herdr-contr-orch runs
```
