import { describe, expect, it } from "vitest";

import { parseFlow } from "./flow";
import { parseSeq } from "./seq";

const names = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`);

describe("parseFlow", () => {
  it("parses arrows, labels and states into layers", () => {
    const flow = parseFlow("issue -> build: plan\nbuild -> review: PR\nreview -> build: blockers\nreview [waiting]\n");
    expect(flow?.edges).toEqual([
      { from: "issue", to: "build", label: "plan" },
      { from: "build", to: "review", label: "PR" },
      { from: "review", to: "build", label: "blockers" },
    ]);
    expect(flow?.nodes.map((n) => [n.name, n.layer, n.state])).toEqual([
      ["issue", 0, undefined], ["build", 1, undefined], ["review", 2, "waiting"],
    ]);
    expect(flow).toMatchObject({ layers: 3, width: 1 });
  });
  it("accepts names with dashes and a cycle with no root", () => {
    expect(parseFlow("b-696 -> lead\nlead -> b-696")?.nodes.map((n) => n.layer)).toEqual([0, 1]);
  });
  it.each([
    ["a chain", "a -> b -> c"],
    ["an unknown state", "a [busy]"],
    ["a line with no arrow", "a b"],
    ["an empty block", "\n"],
    ["a name with a colon in a state", "a:b [done]"],
  ])("refuses %s", (_, src) => expect(parseFlow(src)).toBeNull());
  it("keeps the limits", () => {
    expect(parseFlow(names(12).map((n) => `${n} [info]`).join("\n"))).toBeNull(); // 12 side by side
    expect(parseFlow(names(13).slice(1).map((n, i) => `n${i} -> ${n}`).join("\n"))).toBeNull(); // 13 boxes
    const chain = (n: number) => names(n).slice(1).map((m, i) => `n${i} -> ${m}`).join("\n");
    expect(parseFlow(chain(6))?.layers).toBe(6);
    expect(parseFlow(chain(7))).toBeNull(); // 7 deep
    const fan = (n: number) => names(n).map((m) => `root -> ${m}`).join("\n");
    expect(parseFlow(fan(4))?.width).toBe(4);
    expect(parseFlow(fan(5))).toBeNull(); // 5 side by side
    expect(parseFlow(`${"a".repeat(28)} -> b`)).not.toBeNull();
    expect(parseFlow(`${"a".repeat(29)} -> b`)).toBeNull();
  });
});

describe("parseSeq", () => {
  it("parses messages, replies and self messages", () => {
    expect(parseSeq("owner -> lead: fix #696\nlead -> b-696: build it\nb-696 --> lead: PR open\nlead -> lead: wait")).toEqual({
      actors: ["owner", "lead", "b-696"],
      messages: [
        { from: "owner", to: "lead", text: "fix #696", reply: false },
        { from: "lead", to: "b-696", text: "build it", reply: false },
        { from: "b-696", to: "lead", text: "PR open", reply: true },
        { from: "lead", to: "lead", text: "wait", reply: false },
      ],
    });
  });
  it.each([
    ["no text", "a -> b"],
    ["empty text", "a -> b:  "],
    ["no arrow", "a b: hi"],
    ["a chain", "a -> b -> c: hi"],
    ["an empty block", ""],
  ])("refuses %s", (_, src) => expect(parseSeq(src)).toBeNull());
  it("keeps the limits", () => {
    expect(parseSeq(names(6).map((n) => `a -> ${n}: hi`).join("\n"))).toBeNull(); // 7 actors
    expect(parseSeq(names(5).map((n) => `a -> ${n}: hi`).join("\n"))?.actors).toHaveLength(6);
    expect(parseSeq(Array(16).fill("a -> b: hi").join("\n"))).not.toBeNull();
    expect(parseSeq(Array(17).fill("a -> b: hi").join("\n"))).toBeNull();
    expect(parseSeq(`${"a".repeat(28)} -> b: hi`)).not.toBeNull();
    expect(parseSeq(`${"a".repeat(29)} -> b: hi`)).toBeNull();
    expect(parseSeq(`a -> b: ${"x".repeat(40)}`)).not.toBeNull();
    expect(parseSeq(`a -> b: ${"x".repeat(41)}`)).toBeNull();
  });
});
