import { describe, expect, it } from "vitest";
import { splitTodo, todoCommands } from "./blocks";

describe("splitTodo", () => {
  it("gives each paragraph its new code spans, and code blocks as written", () => {
    expect(splitTodo("Run `pnpm i` then `pnpm test`.\n\nAgain `pnpm i`.\n\n```sh\necho  a\n```\nLast")).toEqual([
      { kind: "text", text: "Run `pnpm i` then `pnpm test`.", spans: ["pnpm i", "pnpm test"] },
      { kind: "text", text: "Again `pnpm i`.", spans: [] },
      { kind: "code", code: "echo  a" },
      { kind: "text", text: "Last", spans: [] },
    ]);
  });

  it("counts one command for each copy row", () => {
    expect(todoCommands(splitTodo("Run `a` in `b`.\n\nAgain `a`.\n\n```sh\nc\n```"))).toBe(3);
    expect(todoCommands(splitTodo("No commands."))).toBe(0);
  });
});
