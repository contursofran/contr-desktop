# The Update button installs the new release (owner, 2026-11-16, #78)

This replaces D97's "the owner drags contr to Applications".

- The Update button downloads `contr-mac-universal.zip`, unpacks it with
  `ditto` and checks the app: the `Info.plist` version is the release version
  and `codesign --verify` passes (ad-hoc is fine).
- "Restart to update" starts a detached swap script and quits. The script
  moves the old app to `contr.app.old`, puts the new one in the same path,
  removes quarantine and opens it. It removes the old copy only after the new
  app runs. On any failure it puts the old app back and opens it.
- When the app's folder is not writable or the release has no `.zip`, the
  button downloads the `.dmg` and opens it, as before.
- The app stays unsigned (D97): no Squirrel.Mac or electron-updater.
