#!/usr/bin/env node
// The fake helper of a core home (core.spec.ts): it answers `version` (protocol 1) and passes each other command to e2e/fake-helper.mjs.
import { spawnSync } from "node:child_process";
import path from "node:path";

const [cmd] = process.argv.slice(2);
if (cmd === "version") {
  const out = (line) => process.stdout.write(`${JSON.stringify(line)}\n`);
  out({ build: "fake", cmd, protocol: 1, sidecar: "0.0.0-fake", type: "header" });
  out({ build: "bbbbbbb 2026-11-17", release: null, type: "version" });
  out({ ms: 1, ok: true, type: "end" });
} else {
  const helper = path.resolve(import.meta.dirname, "../../fake-helper.mjs");
  const r = spawnSync(process.execPath, [helper, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
