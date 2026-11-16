import { describe, expect, it } from "vitest";
import { splitTodo } from "./blocks";

describe("splitTodo", () => {
  it("gives each paragraph its new code spans, and code blocks as written", () => {
    expect(splitTodo("Run `pnpm i` then `pnpm test`.\n\nAgain `pnpm i`.\n\n```sh\necho  a\n```\nLast")).toEqual([
      { kind: "text", text: "Run `pnpm i` then `pnpm test`.", spans: ["pnpm i", "pnpm test"] },
      { kind: "text", text: "Again `pnpm i`.", spans: [] },
      { kind: "code", code: "echo  a" },
      { kind: "text", text: "Last", spans: [] },
    ]);
  });
});
