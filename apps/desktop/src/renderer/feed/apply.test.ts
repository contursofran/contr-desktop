import { describe, expect, it } from "vitest";
import { applyFeed, emptyFeed } from "./apply";

const row = (id: string) => ({ id, k: "assistant", text: id });

describe("applyFeed", () => {
  it("appends all rows on a splice at 0", () => {
    const s = applyFeed(emptyFeed, { type: "splice", at: 0, rows: [row("a"), row("b")], agent: "claude" });
    expect(s.rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(s.agent).toBe("claude");
  });

  it("drops rows from at on, then appends", () => {
    const s0 = applyFeed(emptyFeed, { type: "splice", at: 0, rows: [row("a"), row("b"), row("c")] });
    const s1 = applyFeed(s0, { type: "splice", at: 1, rows: [row("b2")] });
    expect(s1.rows.map((r) => r.id)).toEqual(["a", "b2"]);
  });

  it("clamps an at past the end", () => {
    const s0 = applyFeed(emptyFeed, { type: "splice", at: 0, rows: [row("a")] });
    expect(applyFeed(s0, { type: "splice", at: 9, rows: [row("b")] }).rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps the rows on an error and clears the error on the next splice", () => {
    const s0 = applyFeed(emptyFeed, { type: "splice", at: 0, rows: [row("a")] });
    const s1 = applyFeed(s0, { type: "error", code: "no-core", message: "herdr-core is not running" });
    expect(s1.rows).toHaveLength(1);
    expect(s1.error?.code).toBe("no-core");
    expect(applyFeed(s1, { type: "splice", at: 1, rows: [] }).error).toBeNull();
  });
});
