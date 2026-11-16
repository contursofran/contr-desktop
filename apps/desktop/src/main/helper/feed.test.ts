import path from "node:path";
import { describe, expect, it } from "vitest";
import { readFeedAnswer } from "./feed";
import { helperPath, parseLines, runHelper } from "./run";

const fake = path.resolve(import.meta.dirname, "../../../e2e/fake-helper.mjs");

describe("readFeedAnswer", () => {
  it("gives a splice with the rows and the cursor", () => {
    const answer = readFeedAnswer([
      { type: "header" },
      { type: "log", cursor: "c1", agent: "claude", model: "m" },
      { type: "splice", at: 2, count: 3 },
      { type: "row", id: "a", k: "user", text: "hi" },
      { type: "end", ok: true },
    ]);
    expect(answer).toEqual({ cursor: "c1", event: { type: "splice", at: 2, agent: "claude", model: "m", rows: [{ id: "a", k: "user", text: "hi" }] } });
  });

  it("gives no event on unchanged", () => {
    expect(readFeedAnswer([{ type: "log", cursor: "c2" }, { type: "unchanged" }])).toEqual({ cursor: "c2", event: null });
  });

  it("gives the error line", () => {
    expect(readFeedAnswer([{ type: "error", code: "no-core", message: "down" }]).event).toEqual({ type: "error", code: "no-core", message: "down" });
  });
});

describe("runHelper", () => {
  it("ignores lines that are not JSON", () => {
    expect(parseLines('{"type":"a"}\nnoise\n\n{"x":1}\n')).toEqual([{ type: "a" }]);
  });

  it("reports a helper that is missing as an error", async () => {
    const lines = await runHelper("/nonexistent/herdr-contr-feed", ["feed"]);
    expect(lines).toEqual([expect.objectContaining({ type: "error", code: "helper" })]);
  });

  it("reads the fake helper's answer", async () => {
    process.env.FAKE_HELPER_FIXTURE = path.resolve(import.meta.dirname, "../../../e2e/fixtures/claude-session.jsonl");
    const lines = await runHelper(fake, ["feed", "--terminal", "t1"]);
    expect(lines.filter((l) => l.type === "row")).toHaveLength(14);
  });

  it("takes the helper path from CONTR_HELPER", () => {
    expect(helperPath("/app", { CONTR_HELPER: "/x/feed" })).toBe("/x/feed");
    expect(helperPath("/r/apps/desktop", {})).toBe("/r/bin/herdr-contr-feed");
  });
});
