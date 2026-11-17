import { describe, expect, it } from "vitest";
import { helperProblem } from "./HelperError";

describe("helperProblem", () => {
  it("says the helper is missing when it cannot be started", () =>
    expect(helperProblem({ code: "helper", message: "spawn /x/helper ENOENT" })).toBe("The herdr-contr helper is missing."));
  it("says the helper did not answer for another helper failure", () =>
    expect(helperProblem({ code: "helper", message: "the helper gave no header and end line" })).toBe("The herdr-contr helper did not answer."));
  it("uses herdr-contr's words for a known code", () =>
    expect(helperProblem({ code: "no-terminal", message: "" })).toBe("This agent's terminal is gone."));
  it("falls back for an unknown code", () => expect(helperProblem({ code: "boom", message: "" })).toBe("The conversation could not be loaded."));
});
