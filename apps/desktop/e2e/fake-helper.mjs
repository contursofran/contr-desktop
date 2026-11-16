#!/usr/bin/env node
// A fake herdr-contr-feed for tests. It plays FAKE_HELPER_FIXTURE (JSON Lines of `row` objects).
// `feed` without --cursor gives all rows; with a cursor it gives `unchanged`.
// `$FIXTURES` in a row becomes the fixture folder (an absolute path).
// `send` appends {terminal, text} as one JSON line to FAKE_HELPER_SEND_LOG.
// `paste-image` answers `image` with FAKE_HELPER_PASTE_IMAGE as the path (null when not set).
// FAKE_HELPER_SEND_ERROR=<code> makes `send` answer with that error.
// `working` gives a fixed working line.
// `model`, `status` and `commands` give fixed lines for the reply box; FAKE_HELPER_MODEL=none gives no model.
// FAKE_HELPER_ERROR=<code> makes every command answer with that error.
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const [cmd, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const out = (line) => process.stdout.write(`${JSON.stringify(line)}\n`);
const end = (ok) => out({ ms: 1, ok, type: "end" });

out({ build: "fake", cmd, protocol: 1, sidecar: "0.0.0-fake", type: "header" });
if (process.env.FAKE_HELPER_ERROR) {
  out({ code: process.env.FAKE_HELPER_ERROR, message: `fake error ${process.env.FAKE_HELPER_ERROR}`, type: "error" });
  end(false);
} else if (cmd === "feed") {
  out({ agent: "claude", cursor: "fake.1", model: "claude-opus-5-5", path: "fixture", size: 1, start: 0, type: "log" });
  if (arg("cursor")) out({ type: "unchanged" });
  else {
    const fixtures = path.dirname(process.env.FAKE_HELPER_FIXTURE);
    const rows = readFileSync(process.env.FAKE_HELPER_FIXTURE, "utf8").split("\n").filter((l) => l.trim());
    out({ at: 0, count: rows.length, type: "splice" });
    for (const r of rows) out({ ...JSON.parse(r.replaceAll("$FIXTURES", fixtures)), type: "row" });
  }
  end(true);
} else if (cmd === "send" && process.env.FAKE_HELPER_SEND_ERROR) {
  out({ code: process.env.FAKE_HELPER_SEND_ERROR, message: `fake send error ${process.env.FAKE_HELPER_SEND_ERROR}`, type: "error" });
  end(false);
} else if (cmd === "paste-image") {
  out({ path: process.env.FAKE_HELPER_PASTE_IMAGE ?? null, type: "image" });
  end(true);
} else if (cmd === "working") {
  out({ type: "working", text: "Hashing…", detail: "35s · ↓ 1.2k tokens" });
  end(true);
} else if (cmd === "model") {
  const none = process.env.FAKE_HELPER_MODEL === "none";
  out({ type: "model", agent: "claude", model: none ? null : "claude-opus-5-5", effort: none ? null : "medium" });
  end(true);
} else if (cmd === "status") {
  out({ type: "status", agent: "claude", source: "statusline", tags: [{ kind: "context", percent: 37, text: "ctx 37%", warn: false }] });
  end(true);
} else if (cmd === "commands") {
  const models = [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "claude-sonnet-5", label: "Sonnet 5" }];
  const efforts = ["low", "medium", "high"];
  out({ type: "commands", agent: "claude", commands: [{ name: "model", args: models }, { name: "effort", args: efforts }] });
  end(true);
} else if (cmd === "send") {
  appendFileSync(process.env.FAKE_HELPER_SEND_LOG, `${JSON.stringify({ terminal: arg("terminal"), text: arg("text") })}\n`);
  out({ type: "done" });
  end(true);
} else {
  out({ code: "usage", message: `unknown command ${cmd}`, type: "error" });
  end(false);
}
