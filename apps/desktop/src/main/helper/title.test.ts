import { describe, expect, it } from "vitest";
import { readTabTitle, readTitle } from "./title";

describe("readTitle", () => {
  it("uses the title", () => expect(readTitle('{"title":"Audit","name":"w-1"}', "t7")).toBe("Audit"));
  it("falls back to the name", () => expect(readTitle('{"title":"","name":"w-1"}', "t7")).toBe("w-1"));
  it("falls back to the terminal when hc fails", () =>
    expect(readTitle('{"error":{"kind":"not_found"}}', "t7")).toBe("t7"));
  it("falls back to the terminal when the answer is not JSON", () => expect(readTitle("", "t7")).toBe("t7"));
});

describe("readTabTitle", () => {
  it("uses the title", () => expect(readTabTitle('{"title":"Audit","agent":"codex","address":"t7"}')).toBe("Audit"));
  it("falls back to the program name", () => {
    expect(readTabTitle('{"title":"","agent":"claude-code","address":"t7"}')).toBe("Claude Code");
    expect(readTabTitle('{"agent":"codex","address":"t7"}')).toBe("Codex");
  });
  it("never gives the terminal id", () => {
    expect(readTabTitle('{"title":"","name":"w-1","address":"t7"}')).toBe("Terminal");
    expect(readTabTitle('{"agent":"vim","address":"t7"}')).toBe("Terminal");
    expect(readTabTitle("")).toBe("Terminal");
  });
});
