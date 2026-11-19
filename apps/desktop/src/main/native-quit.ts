import { spawn } from "node:child_process";

// Chromium can stall after Electron emits "quit" on a busy Mac.
// https://github.com/electron/electron/issues/55647
const QUIT_LIMIT_SECONDS = "2";
const WATCH_PARENT = `
  /bin/sleep "$2"
  parent=$(/bin/ps -p "$$" -o ppid=) || exit 0
  if [ "$parent" -eq "$1" ]; then
    kill -KILL "$1"
  fi
`;

/** End the native shutdown if it stalls. The watcher can only signal the app that started it. */
export function armNativeQuitDeadline(): void {
  const watcher = spawn("/bin/sh", ["-c", WATCH_PARENT, "contr-quit", String(process.pid), QUIT_LIMIT_SECONDS], {
    detached: true,
    stdio: "ignore",
  });
  watcher.once("error", (error) => console.error(`contr: cannot start quit watcher: ${error.message}`));
  watcher.unref();
}
