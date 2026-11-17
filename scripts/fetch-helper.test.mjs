// node --test scripts/fetch-helper.test.mjs (CI runs it on each pull request).
// Runs a copy of scripts/fetch-helper in a temp folder, so it writes a temp bin/, with a fake gh first on PATH.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "fetch-helper");
const tag = "build-2026-11-17-abcdef1";

// The fake gh: logs its arguments, one call per line. "release list" prints $FAKE_TAG;
// "release download" copies $FAKE_ZIP into the --dir folder.
const fakeGh = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
if [ "$1 $2" = "release list" ]; then
  printf '%s\\n' "$FAKE_TAG"
  exit 0
fi
if [ "$1 $2" = "release download" ]; then
  while [ $# -gt 0 ]; do
    if [ "$1" = "--dir" ]; then cp "$FAKE_ZIP" "$2/"; fi
    shift
  done
  exit 0
fi
echo "fake gh: unexpected $*" >&2
exit 3
`;

let dirs = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** A zip with the Contract's layout: herdr-contr-<tag>/bin/... and remote/... . */
function makeZip(dir, { orch = true } = {}) {
  const top = join(dir, "zipsrc", `herdr-contr-${tag}`);
  const files = ["bin/herdr-contr-feed", "remote/x86_64-unknown-linux-musl/herdr-contr-feed", "install.sh"];
  if (orch) files.push("bin/herdr-contr-orch");
  for (const f of files) {
    mkdirSync(dirname(join(top, f)), { recursive: true });
    writeFileSync(join(top, f), `#!/bin/sh\necho ${f}\n`);
  }
  const zip = join(dir, `herdr-contr-${tag}.zip`);
  const r = spawnSync("zip", ["-q", "-r", zip, `herdr-contr-${tag}`], { cwd: join(dir, "zipsrc") });
  assert.equal(r.status, 0, String(r.stderr));
  return zip;
}

/** Runs the copied script. Returns the exit status, stderr, the gh calls and the temp root. */
function run({ env = {}, release = tag, orch = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "fetch-helper-test-"));
  dirs.push(dir);
  const root = join(dir, "repo");
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(script, join(root, "scripts", "fetch-helper"));
  chmodSync(join(root, "scripts", "fetch-helper"), 0o755);
  const fakeBin = join(dir, "fakebin");
  mkdirSync(fakeBin);
  writeFileSync(join(fakeBin, "gh"), fakeGh);
  chmodSync(join(fakeBin, "gh"), 0o755);
  const log = join(dir, "gh.log");
  writeFileSync(log, "");
  const baseEnv = { ...process.env };
  delete baseEnv.HERDR_CONTR_REPO;
  const r = spawnSync(join(root, "scripts", "fetch-helper"), [], {
    encoding: "utf8",
    env: {
      ...baseEnv,
      PATH: `${fakeBin}:${process.env.PATH}`,
      FAKE_LOG: log,
      FAKE_TAG: release,
      FAKE_ZIP: makeZip(dir, { orch }),
      ...env,
    },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
  return { status: r.status, stderr: r.stderr, calls, root };
}

test("reads contr-core by default", () => {
  const { status, calls } = run();
  assert.equal(status, 0);
  assert.ok(calls.length > 0);
  for (const c of calls) assert.match(c, / -R contursofran\/contr-core /);
});

test("HERDR_CONTR_REPO wins", () => {
  const { status, calls } = run({ env: { HERDR_CONTR_REPO: "o/r" } });
  assert.equal(status, 0);
  assert.ok(calls.length > 0);
  for (const c of calls) assert.match(c, / -R o\/r /);
});

test("skips prereleases", () => {
  const { calls } = run();
  const list = calls.find((c) => c.startsWith("release list"));
  assert.ok(list);
  assert.match(list, / --exclude-pre-releases /);
});

test("puts both programs, the Linux helper and RELEASE", () => {
  const { status, root } = run();
  assert.equal(status, 0);
  for (const f of ["bin/herdr-contr-feed", "bin/herdr-contr-orch", "bin/linux-x64/herdr-contr-feed"]) {
    assert.ok(existsSync(join(root, f)), `${f} is missing`);
  }
  assert.equal(readFileSync(join(root, "bin/RELEASE"), "utf8"), `${tag}\n`);
});

test("a zip without herdr-contr-orch fails", () => {
  const { status, stderr, root } = run({ orch: false });
  assert.equal(status, 1);
  assert.match(stderr, /herdr-contr-orch is not in/);
  assert.ok(!existsSync(join(root, "bin/RELEASE")));
});

test("no build- release fails", () => {
  const { status, stderr, calls } = run({ release: "" });
  assert.equal(status, 1);
  assert.match(stderr, /no build-\* release in/);
  assert.ok(!calls.some((c) => c.startsWith("release download")));
});
