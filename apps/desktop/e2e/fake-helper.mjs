#!/usr/bin/env node
// A fake herdr-contr-feed for tests. It plays FAKE_HELPER_FIXTURE (JSON Lines of `row` objects).
// `feed` without --cursor gives all rows; with a cursor it gives the rows appended since, or `unchanged`.
// `$FIXTURES` in a row becomes the fixture folder (an absolute path).
// `send` appends {terminal, text} as one JSON line to FAKE_HELPER_SEND_LOG.
// `paste-image` answers `image` with FAKE_HELPER_PASTE_IMAGE as the path (null when not set).
// FAKE_HELPER_SEND_ERROR=<code> makes `send` answer with that error.
// `working` gives a fixed working line.
// `card` prints the `card` line in FAKE_HELPER_CARD (a JSON file), else `{"type":"card"}` (no card).
// `approve` and `answer` append {cmd, terminal, request, allow|answers} to FAKE_HELPER_ANSWER_LOG and answer
// `done` with FAKE_HELPER_ANSWER_RESULT (default `sent`).
// `model`, `status` and `commands` give fixed lines for the reply box; FAKE_HELPER_MODEL=none gives no model.
// `usage` gives Claude and Codex plans that reset some hours and days from now.
// FAKE_HELPER_CALL_LOG=<file>: each call appends its arguments as one JSON list.
// FAKE_HELPER_ERROR=<code> makes every command answer with that error.
// FAKE_HELPER_ERROR_WHILE=<file> does the same with the code `no-core` while that file is there.
// The worker terminals of fake-hc.mjs (t8 to t10) have their own session in fixtures/workers: `feed`, `model`, `status`,
// `working` and `card` give that worker's data. FAKE_HELPER_CARD and FAKE_HELPER_MODEL=none still win.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workerDir = path.join(import.meta.dirname, "fixtures", "workers");
// b-30 works, b-40 waits on a permission prompt (no working line), b-50 is done (no working line).
const workers = {
  t8: { fixture: "b-30.jsonl", model: "claude-sonnet-5", effort: "high", context: 22, working: { text: "Drawing…", detail: "2m 4s · ↓ 3.1k tokens" } },
  t9: { fixture: "b-40.jsonl", model: "claude-opus-5-5", effort: "high", context: 58, working: null, card: "b-40-card.json" },
  t10: { fixture: "b-50.jsonl", model: "claude-opus-5-5", effort: "medium", context: 71, working: null },
};

const [cmd, ...rest] = process.argv.slice(2);
if (process.env.FAKE_HELPER_CALL_LOG) appendFileSync(process.env.FAKE_HELPER_CALL_LOG, `${JSON.stringify(process.argv.slice(2))}\n`);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const out = (line) => process.stdout.write(`${JSON.stringify(line)}\n`);
const end = (ok) => out({ ms: 1, ok, type: "end" });
const worker = workers[arg("terminal")];

out({ build: "fake", cmd, protocol: 1, sidecar: "0.0.0-fake", type: "header" });
const failing = process.env.FAKE_HELPER_ERROR || (process.env.FAKE_HELPER_ERROR_WHILE && existsSync(process.env.FAKE_HELPER_ERROR_WHILE) && "no-core");
if (failing) {
  out({ code: failing, message: `fake error ${failing}`, type: "error" });
  end(false);
} else if (cmd === "feed") {
  // The cursor is the row count: rows appended to the fixture since then come as a splice.
  const fixture = worker ? path.join(workerDir, worker.fixture) : process.env.FAKE_HELPER_FIXTURE;
  const rows = readFileSync(fixture, "utf8").split("\n").filter((l) => l.trim());
  const seen = Number(arg("cursor")?.slice("fake.".length) ?? 0);
  out({ agent: "claude", cursor: `fake.${rows.length}`, model: worker?.model ?? "claude-opus-5-5", path: "fixture", size: 1, start: 0, type: "log" });
  if (seen >= rows.length) out({ type: "unchanged" });
  else {
    const fixtures = path.dirname(fixture);
    out({ at: seen, count: rows.length - seen, type: "splice" });
    for (const r of rows.slice(seen)) out({ ...JSON.parse(r.replaceAll("$FIXTURES", fixtures)), type: "row" });
  }
  end(true);
} else if (cmd === "send" && process.env.FAKE_HELPER_SEND_ERROR) {
  out({ code: process.env.FAKE_HELPER_SEND_ERROR, message: `fake send error ${process.env.FAKE_HELPER_SEND_ERROR}`, type: "error" });
  end(false);
} else if (cmd === "paste-image") {
  out({ path: process.env.FAKE_HELPER_PASTE_IMAGE ?? null, type: "image" });
  end(true);
} else if (cmd === "usage") {
  const now = Math.floor(Date.now() / 1000);
  const h = (n) => now + n * 3600 + 600;
  // FAKE_HELPER_USAGE=stale: Claude read 2 days ago with each window past its reset; Codex with its own kinds.
  const plans = process.env.FAKE_HELPER_USAGE === "stale"
    ? [
        { plan: "claude", read_at: now - 2 * 86_400, windows: [{ kind: "five_hour", used_percent: 12, resets_at: h(-40) }, { kind: "seven_day", used_percent: 17, resets_at: h(-1) }] },
        { plan: "codex", read_at: now - 2 * 3600, windows: [{ kind: "primary", used_percent: 8, resets_at: h(3) }, { kind: "secondary", used_percent: 33.2, resets_at: h(100) }] },
      ]
    : [
        { plan: "claude", read_at: now, windows: [{ kind: "five_hour", used_percent: 38.4, resets_at: h(2) }, { kind: "seven_day", used_percent: 64.2, resets_at: h(96) }] },
        { plan: "codex", read_at: now, windows: [{ kind: "five_hour", used_percent: 21.0, resets_at: h(3) }, { kind: "seven_day", used_percent: 9.0, resets_at: h(130) }] },
      ];
  out({ type: "usage", plans });
  end(true);
} else if (cmd === "working") {
  // The helper gives null text and detail when the agent does not work.
  const line = worker ? (worker.working ?? { text: null, detail: null }) : { text: "Hashing…", detail: "35s · ↓ 1.2k tokens" };
  out({ type: "working", ...line });
  end(true);
} else if (cmd === "card") {
  const file = process.env.FAKE_HELPER_CARD ?? (worker?.card && path.join(workerDir, worker.card));
  const card = file ? JSON.parse(readFileSync(file, "utf8")) : {};
  out({ ...card, type: "card" });
  end(true);
} else if (cmd === "approve" || cmd === "answer") {
  const got = { cmd, terminal: arg("terminal"), request: arg("request") };
  if (cmd === "approve") got.allow = rest.includes("--allow") && !rest.includes("--deny");
  else got.answers = JSON.parse(arg("answers"));
  if (process.env.FAKE_HELPER_ANSWER_LOG) appendFileSync(process.env.FAKE_HELPER_ANSWER_LOG, `${JSON.stringify(got)}\n`);
  out({ result: process.env.FAKE_HELPER_ANSWER_RESULT ?? "sent", type: "done" });
  end(true);
} else if (cmd === "model") {
  const none = process.env.FAKE_HELPER_MODEL === "none";
  out({ type: "model", agent: "claude", model: none ? null : (worker?.model ?? "claude-opus-5-5"), effort: none ? null : (worker?.effort ?? "medium") });
  end(true);
} else if (cmd === "status") {
  const percent = worker?.context ?? 37;
  out({ type: "status", agent: "claude", source: "statusline", tags: [{ kind: "context", percent, text: `ctx ${percent}%`, warn: false }] });
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
