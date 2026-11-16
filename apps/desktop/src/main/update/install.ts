import { execFile, spawn } from "node:child_process";
import { accessSync, constants, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** The .app bundle that holds the executable, or null when the executable is not in a bundle. */
export function bundleOf(exe: string): string | null {
  const i = exe.indexOf(".app/");
  return i < 0 ? null : exe.slice(0, i + 4);
}

/** True when the app's folder can take a new bundle (the swap moves the old app aside in it). */
export function writable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unpacks the release .zip with ditto into a new temp folder and checks the app in it:
 * the Info.plist version is the release version and `codesign --verify` passes (ad-hoc is fine).
 * Returns the path of the new .app. Throws with the step that failed.
 */
export async function unpack(zip: string, version: string): Promise<string> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-update-"));
  await run("ditto", ["-x", "-k", zip, dir]);
  const name = readdirSync(dir).find((f) => f.endsWith(".app"));
  if (!name) throw new Error("The .zip has no app.");
  const app = path.join(dir, name);
  const { stdout } = await run("plutil", ["-extract", "CFBundleShortVersionString", "raw", path.join(app, "Contents/Info.plist")]);
  if (stdout.trim() !== version) throw new Error(`The app in the .zip is ${stdout.trim()}, not ${version}.`);
  try {
    await run("codesign", ["--verify", "--deep", app]);
  } catch {
    throw new Error("The app in the .zip fails codesign --verify.");
  }
  return app;
}

/**
 * The swap script: waits for the pid to end, moves the old app to <app>.old, moves the new one in,
 * removes quarantine and opens it. It removes the old copy only after the new app runs; on any failure
 * it puts the old app back and opens it. SWAP_OPEN, SWAP_RUNNING and SWAP_WAIT replace open, the
 * running check and its wait in unit tests.
 */
export const SWAP_SCRIPT = `#!/bin/sh
pid="$1"; app="$2"; new="$3"
open_cmd="\${SWAP_OPEN:-open}"; wait_s="\${SWAP_WAIT:-3}"
running() { if [ -n "$SWAP_RUNNING" ]; then $SWAP_RUNNING; else pgrep -f "$app/Contents/MacOS/" >/dev/null; fi; }
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
rm -rf "$app.old"
mv "$app" "$app.old" || { $open_cmd "$app"; exit 1; }
if ditto "$new" "$app" && codesign --verify --deep "$app" 2>/dev/null; then
  xattr -dr com.apple.quarantine "$app" 2>/dev/null
  if $open_cmd "$app"; then
    sleep "$wait_s"
    if running; then rm -rf "$app.old" "$new"; exit 0; fi
  fi
fi
rm -rf "$app"
mv "$app.old" "$app"
$open_cmd "$app"
exit 1
`;

/** Writes the swap script and starts it detached, so it outlives this app. The caller quits the app next. */
export function startSwap(pid: number, app: string, next: string): void {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-swap-")), "swap.sh");
  writeFileSync(file, SWAP_SCRIPT, { mode: 0o755 });
  spawn("/bin/sh", [file, String(pid), app, next], { detached: true, stdio: "ignore" }).unref();
}
