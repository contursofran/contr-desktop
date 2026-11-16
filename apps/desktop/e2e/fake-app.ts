import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Makes a small ad-hoc signed contr.app (macOS only) with the given version, and its .zip made with ditto,
 * as the release has. Returns the folder that holds both. `sign: false` leaves the app unsigned.
 */
export function fakeApp(version: string, sign = true): { dir: string; app: string; zip: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-fake-app-"));
  const app = path.join(dir, "contr.app");
  mkdirSync(path.join(app, "Contents/MacOS"), { recursive: true });
  writeFileSync(
    path.join(app, "Contents/Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>contr</string>
<key>CFBundleIdentifier</key><string>test.contr.fake</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
</dict></plist>
`,
  );
  copyFileSync("/usr/bin/true", path.join(app, "Contents/MacOS/contr"));
  if (sign) execFileSync("codesign", ["--force", "--sign", "-", app], { stdio: "ignore" });
  const zip = path.join(dir, "contr-mac-universal.zip");
  execFileSync("ditto", ["-c", "-k", "--keepParent", app, zip]);
  return { dir, app, zip };
}
