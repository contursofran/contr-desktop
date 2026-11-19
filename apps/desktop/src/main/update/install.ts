import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, createReadStream, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ZIP } from "./release";

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
 * Verifies the hash before unpacking the .zip with ditto into a new temp folder.
 * the Info.plist version is the release version and `codesign --verify` passes (ad-hoc is fine).
 * Returns the path of the new .app. Throws with the step that failed.
 */
export async function unpack(zip: string, version: string, sha256: string | null): Promise<string> {
  if (!sha256) throw new Error("The release has no valid SHA-256 for the .zip.");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(zip)) hash.update(chunk);
  if (hash.digest("hex") !== sha256) throw new Error("The .zip does not match the release SHA-256.");

  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-update-"));
  try {
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
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

/** Removes the archive once the download and unpack attempt ends. */
export async function stageZip(download: (file: string) => Promise<void>, version: string, sha256: string | null): Promise<string> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-zip-"));
  const file = path.join(dir, ZIP);
  try {
    await download(file);
    return await unpack(file, version, sha256);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The swap script: waits for the pid to end, moves the old app to <app>.old, moves the new one in,
 * removes quarantine and opens it. It removes the old copy only after the new app runs; on any failure
 * it puts the old app back and opens it. SWAP_OPEN, SWAP_RUNNING and SWAP_WAIT replace open, the
 * running check and its wait in unit tests.
 */
export const SWAP_SCRIPT = `#!/bin/sh
pid="$1"; app="$2"; new="$3"
trap 'rm -rf "\${new%/*}"' EXIT
open_cmd="\${SWAP_OPEN:-open}"; wait_s="\${SWAP_WAIT:-3}"
running() { if [ -n "$SWAP_RUNNING" ]; then $SWAP_RUNNING; else pgrep -f "$app/Contents/MacOS/" >/dev/null; fi; }
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
rm -rf "$app.old"
mv "$app" "$app.old" || { $open_cmd "$app"; exit 1; }
if ditto "$new" "$app" && codesign --verify --deep "$app" 2>/dev/null; then
  xattr -dr com.apple.quarantine "$app" 2>/dev/null
  if $open_cmd "$app"; then
    sleep "$wait_s"
    if running; then rm -rf "$app.old"; exit 0; fi
  fi
fi
rm -rf "$app"
mv "$app.old" "$app"
$open_cmd "$app"
exit 1
`;

/** Starts the swap script detached, so it outlives this app. The caller quits the app next. */
export async function startSwap(pid: number, app: string, next: string): Promise<void> {
  const child = spawn("/bin/sh", ["-c", SWAP_SCRIPT, "contr-swap", String(pid), app, next], { detached: true, stdio: "ignore" });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}
