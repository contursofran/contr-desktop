"""Run the pre-PR checks in one shared slot on a local Mac or Linux host."""
import argparse
import fcntl
import os
from pathlib import Path
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("specs", nargs="*", help="Electron specs such as e2e/app.spec.ts")
    parser.add_argument("--full-e2e", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.full_e2e and args.specs:
        parser.error("choose specs or --full-e2e")
    for spec in args.specs:
        if not spec.startswith("e2e/") or not spec.endswith(".spec.ts") or not (root / "apps/desktop" / spec).is_file():
            parser.error(f"unknown Electron spec: {spec}")

    # Worktrees share the user temp directory. Keep the inode after release
    # so waiting and incoming processes always lock the same file.
    lock = Path(tempfile.gettempdir()) / f"contr-desktop-verify-{os.getuid()}.lock"
    with lock.open("a") as slot:
        start = time.monotonic()
        print("Waiting for the local verification slot", flush=True)
        fcntl.flock(slot, fcntl.LOCK_EX)
        print(f"Acquired slot after {time.monotonic() - start:.1f}s", flush=True)
        checks = [["typecheck"], ["lint"], ["test"], ["test:browser"]]
        if args.specs or args.full_e2e:
            checks.append(["e2e", "--workers=2", *args.specs])
        for check in checks:
            result = subprocess.run(["pnpm", *check], cwd=root, pass_fds=(slot.fileno(),))
            if result.returncode:
                return result.returncode if result.returncode > 0 else 128 - result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
