import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { answer, approve } from "./card";
import { sendText } from "./feed";

// The helper takes the word after `--text`, `--request` and `--answers` as the value, also one that starts with "-".
// `--text=<value>` is not a form it reads: the value goes as its own word.
const fake = path.resolve(import.meta.dirname, "../../../e2e/fake-helper.mjs");
let log = "";
const calls = () => readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);

beforeEach(() => {
  log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-args-")), "calls.jsonl");
  process.env.FAKE_HELPER_CALL_LOG = log;
  process.env.FAKE_HELPER_SEND_LOG = `${log}.send`;
});
afterEach(() => {
  delete process.env.FAKE_HELPER_CALL_LOG;
  delete process.env.FAKE_HELPER_SEND_LOG;
});

it("sends a text that starts with '-' as the word after --text", async () => {
  expect(await sendText(fake, "t1", "- fix the test\n- a")).toEqual({ ok: true });
  expect(calls()).toEqual([["send", "--terminal", "t1", "--text", "- fix the test\n- a"]]);
});

it("gives the request and the answers as the words after their flags", async () => {
  await approve(fake, "t1", "-r1", false);
  await answer(fake, "t1", "-r2", [{ picks: [], other: "-1" }]);
  expect(calls()).toEqual([
    ["approve", "--terminal", "t1", "--request", "-r1", "--deny"],
    ["answer", "--terminal", "t1", "--request", "-r2", "--answers", '[{"picks":[],"other":"-1"}]'],
  ]);
});
