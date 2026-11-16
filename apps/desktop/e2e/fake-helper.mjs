#!/usr/bin/env node
// A fake herdr-contr-feed for tests. It plays FAKE_HELPER_FIXTURE (JSON Lines of `row` objects).
// `feed` without --cursor gives all rows; with a cursor it gives the rows appended since, or `unchanged`.
// `send` appends {terminal, text} as one JSON line to FAKE_HELPER_SEND_LOG.
// `paste-image` answers `image` with FAKE_HELPER_PASTE_IMAGE as the path (null when not set).
// FAKE_HELPER_SEND_ERROR=<code> makes `send` answer with that error.
// `working` gives a fixed working line.
// FAKE_HELPER_ERROR=<code> makes every command answer with that error.
import { appendFileSync, readFileSync } from "node:fs";

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
  // The cursor is the row count: rows appended to the fixture since then come as a splice.
  const rows = readFileSync(process.env.FAKE_HELPER_FIXTURE, "utf8").split("\n").filter((l) => l.trim());
  const seen = Number(arg("cursor")?.slice("fake.".length) ?? 0);
  out({ agent: "claude", cursor: `fake.${rows.length}`, model: "claude-opus-5-5", path: "fixture", size: 1, start: 0, type: "log" });
  if (seen >= rows.length) out({ type: "unchanged" });
  else {
    out({ at: seen, count: rows.length - seen, type: "splice" });
    for (const r of rows.slice(seen)) out({ ...JSON.parse(r), type: "row" });
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
} else if (cmd === "send") {
  appendFileSync(process.env.FAKE_HELPER_SEND_LOG, `${JSON.stringify({ terminal: arg("terminal"), text: arg("text") })}\n`);
  out({ type: "done" });
  end(true);
} else {
  out({ code: "usage", message: `unknown command ${cmd}`, type: "error" });
  end(false);
}
