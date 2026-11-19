import { describe, expect, it } from "vitest";
import { parseDigest, parseQueue, parseStatus } from "./parse";

describe("parseStatus", () => {
  it("reads one worker per line", () => {
    expect(parseStatus("b-649 | #649 | Rows and badge\n\nb-665|#665|Fewer lines\n")).toEqual([
      { worker: "b-649", issue: 649, text: "Rows and badge" },
      { worker: "b-665", issue: 665, text: "Fewer lines" },
    ]);
  });
  it.each(["", "b-1 | 649 | x", "b-1 | #649", "b 1 | #649 | x", "b-1 | #649 | ", "b-1 | #649 | x | y"])("refuses %j", (code) => {
    expect(parseStatus(code)).toBeNull();
  });
});

describe("parseQueue", () => {
  it("reads an explicit owner item while keeping prose and PR refs in the note", () => {
    expect(parseQueue("#41 Queue block -- waits for #31, and for your answer | owner: D7")).toEqual([
      { number: 41, label: "Queue block", note: "waits for #31, and for your answer", ownerId: "D7" },
    ]);
    expect(parseQueue("#41 Queue block -- D7 waits")).toEqual([
      { number: 41, label: "Queue block", note: "D7 waits" },
    ]);
    expect(parseQueue("#41 Queue block -- waits for a question | owner: X7")).toBeNull();
  });

  it("reads the steps in order, with the dependency note", () => {
    expect(parseQueue("#656 Rows and badge\n#665 Fewer lines -- waits for #656")).toEqual([
      { number: 656, label: "Rows and badge", note: null },
      { number: 665, label: "Fewer lines", note: "waits for #656" },
    ]);
  });
  it.each(["", "656 Rows", "#656", "- #656 Rows"])("refuses %j", (code) => {
    expect(parseQueue(code)).toBeNull();
  });
});

describe("parseDigest", () => {
  it("takes only an empty block", () => {
    expect(parseDigest("")).toBe(true);
    expect(parseDigest("\n  \n")).toBe(true);
    expect(parseDigest("last 3h")).toBe(false);
  });
});
