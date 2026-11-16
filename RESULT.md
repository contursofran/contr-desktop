# Result: #87 ad-hoc signed release

- PR: #91 (`agent/87-adhoc-sign` into `main`), `Fixes #87`
- Head: `e2c3b3f`
- Checks: local `pnpm typecheck`, `pnpm lint`, `pnpm test` (189 passed), `pnpm e2e` (45 passed) all pass on the head. The `CI` check on the PR was pending at report time.

## What changed

- `apps/desktop/electron-builder.yml`: `mac.identity: "-"` (ad-hoc), `hardenedRuntime: false`. electron-builder 26.18 signs the merged universal app (log: `signing file=release/mac-universal/contr.app ... identityName=-`). No hook needed.
- `.github/workflows/release.yml`: macOS step after `scripts/check-bundle`: `ditto -x -k` of the `.zip` into `mktemp -d`, then `codesign --verify --deep --strict --verbose=2`. Release notes say "ad-hoc signed, with no certificate".
- `apps/desktop/e2e/update.spec.ts`: the `.zip` for the install test is built by electron-builder with the real `electron-builder.yml` (scratch project, local arch, local Electron, `compression: store`). The scratch folder is removed after the tests.
- Docs: `docs/reference/releases.md`, `docs/decisions/80-auto-install.md`.
- `install.ts` and the swap script: no change.

## codesign output

Before, release `build-2026-11-16-d9159d1`:

```
out/contr.app: code object is not signed at all
Identifier=Electron
CodeDirectory v=20400 size=392 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Info.plist=not bound
Sealed Resources=none
```

After, local `pnpm dist -c.extraMetadata.version=0.1.999`, `.zip` unpacked with `ditto -x -k`, `codesign --verify --deep --strict --verbose=2`:

```
--validated:.../contr.app/Contents/Frameworks/contr Helper (GPU).app
--validated:.../contr.app/Contents/Frameworks/contr Helper (Plugin).app
--validated:.../contr.app/Contents/Frameworks/ReactiveObjC.framework/Versions/Current/.
--validated:.../contr.app/Contents/Frameworks/Mantle.framework/Versions/Current/.
--validated:.../contr.app/Contents/Frameworks/contr Helper.app
--validated:.../contr.app/Contents/Frameworks/Squirrel.framework/Versions/Current/.
--validated:.../contr.app/Contents/Frameworks/contr Helper (Renderer).app
--validated:.../contr.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Helpers/app_shim_loader
--validated:.../contr.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Helpers/chrome_crashpad_handler
--validated:.../contr.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/.
.../contr.app: valid on disk
.../contr.app: satisfies its Designated Requirement
exit 0
Identifier=dev.contr.desktop
Format=app bundle with Mach-O universal (x86_64 arm64)
CodeDirectory v=20400 size=426 flags=0x2(adhoc) hashes=3+7 location=embedded
Signature=adhoc
TeamIdentifier=not set
Sealed Resources version=2 rules=13 files=15
```

The `.dmg` app (mounted `-nobrowse -readonly`): "valid on disk", "satisfies its Designated Requirement". `scripts/check-bundle` on the unpacked app: `bundle ok`.

## Other proof

- The real `unpack` on the built `.zip` with a quarantine attribute passes. `SWAP_SCRIPT` (fake `open`) over a copy of the 0.1.10 app: exit 0, new version, quarantine gone, `codesign --verify --deep --strict` passes. No second defect in `unpack` or the swap script.
- The built executable runs with `ELECTRON_RUN_AS_NODE=1` (no window): `runs 45.3.2 arm64`.
- The guard's commands: exit 1 on the old `.zip`, exit 0 on the new one.
- The e2e test "with a writable app folder a press installs from the .zip..." fails with `identity: null` ("Download failed: The app in the .zip fails codesign --verify.") and passes with the fix.

## Deviations

- The test is in e2e (`update.spec.ts`), not in `install.test.ts`: it needs electron-builder and the local Electron, which `pnpm e2e` downloads. It adds about 15 to 40 s to e2e.
- `hardenedRuntime: false` is my choice, not in the brief: electron-builder warns that ad-hoc with the hardened runtime needs an extra entitlement.

## Unverified

- The release workflow and its guard step: they run first after the merge.
- The Update from the installed 0.1.10 or 0.1.11 to that release.
- Gatekeeper's first open of an ad-hoc signed app: the docs and release notes keep the old text.

> [!WARNING]
> PR #89 (b-86) also changes `apps/desktop/e2e/update.spec.ts` and `docs/reference/releases.md`. A merge conflict is possible for the PR that merges second.

## Made outside the worktree

- About 40 `contr-update-*`, `contr-swap-*` and `contr-fake-app-*` folders in `$TMPDIR` come from unit and e2e test runs (the existing tests leave them; other worktrees' runs can add to them too). Remove: `rm -rf "${TMPDIR:?}"/contr-update-* "${TMPDIR:?}"/contr-swap-* "${TMPDIR:?}"/contr-fake-app-*`.
- Electron downloads in the electron-builder cache (`~/Library/Caches/electron`), made by `pnpm dist`; they can be kept. Remove: `rm -rf ~/Library/Caches/electron`.
- In the worktree (git ignores them): `apps/desktop/release` (965 MB) and `bin` (30 MB). Remove with the worktree, or `rm -rf apps/desktop/release`.
