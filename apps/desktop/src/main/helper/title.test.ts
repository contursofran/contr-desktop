import { describe, expect, it } from "vitest";
import { readTitle } from "./title";

describe("readTitle", () => {
  it("uses the title", () => expect(readTitle('{"title":"Audit","name":"w-1"}', "t7")).toBe("Audit"));
  it("falls back to the name", () => expect(readTitle('{"title":"","name":"w-1"}', "t7")).toBe("w-1"));
  it("falls back to the terminal when hc fails", () =>
    expect(readTitle('{"error":{"kind":"not_found"}}', "t7")).toBe("t7"));
  it("falls back to the terminal when the answer is not JSON", () => expect(readTitle("", "t7")).toBe("t7"));
});
