import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { answer, approve, readCard, readCardAnswer, readDone } from "./card";

const fake = path.resolve(import.meta.dirname, "../../../e2e/fake-helper.mjs");
const fixture = (name: string) => path.resolve(import.meta.dirname, `../../../e2e/fixtures/cards/${name}.json`);

describe("readCardAnswer", () => {
  it("gives null when no card is on screen or the helper fails", () => {
    expect(readCardAnswer([{ type: "header" }, { type: "card" }, { type: "end" }])).toBeNull();
    expect(readCardAnswer([{ type: "error", code: "core", message: "x" }])).toBeNull();
  });
  it("reads an approval", () => {
    expect(readCardAnswer([{ type: "card", kind: "approval", request: "r1", title: "Bash command", command: "ls", tool: "Bash" }])).toEqual({
      kind: "approval", request: "r1", title: "Bash command", command: "ls", tool: "Bash", answered: false,
    });
  });
});

describe("readDone", () => {
  it("gives the result, and failed for an error", () => {
    expect(readDone([{ type: "done", result: "changed", message: "m" }])).toEqual({ result: "changed", message: "m" });
    expect(readDone([{ type: "error", code: "core", message: "no core" }])).toEqual({ result: "failed", message: "no core" });
  });
});

describe("with the fake helper", () => {
  it("reads each card fixture", async () => {
    process.env.FAKE_HELPER_CARD = fixture("multi-question");
    const card = await readCard(fake, "t7");
    expect(card?.kind === "question" && card.question.questions[0]?.multi).toBe(true);
    delete process.env.FAKE_HELPER_CARD;
    expect(await readCard(fake, "t7")).toBeNull();
  });
  it("passes approve and answer to the helper", async () => {
    const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-card-")), "a.jsonl");
    process.env.FAKE_HELPER_ANSWER_LOG = log;
    expect(await approve(fake, "t7", "r1", false)).toEqual({ result: "sent" });
    expect(await answer(fake, "t7", "r2", [{ picks: [0, 2] }, { picks: [], other: "later" }])).toEqual({ result: "sent" });
    delete process.env.FAKE_HELPER_ANSWER_LOG;
    expect(readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l))).toEqual([
      { cmd: "approve", terminal: "t7", request: "r1", allow: false },
      { cmd: "answer", terminal: "t7", request: "r2", answers: [{ picks: [0, 2] }, { picks: [], other: "later" }] },
    ]);
  });
});
