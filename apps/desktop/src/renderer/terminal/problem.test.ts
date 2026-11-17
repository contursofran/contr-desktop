import { describe, expect, it } from "vitest";
import { terminalProblem } from "./problem";

describe("terminalProblem", () => {
  it("says hc is missing when it cannot be started", () =>
    expect(terminalProblem("hc: spawn hc ENOENT")).toBe("hc is not installed, or it is not on the PATH."));
  it("says the terminal is gone when hc does not know it", () =>
    expect(terminalProblem('no terminal "t9"')).toBe("This terminal is not in hc. It may have closed."));
  it("says the terminal ended when its stream closed", () => expect(terminalProblem("the terminal stream ended")).toBe("The terminal ended."));
  it("says the connection ended when hc exited", () => {
    expect(terminalProblem("hc closed the connection")).toBe("The connection to hc ended.");
    expect(terminalProblem("hc closed the connection: server not running")).toBe("The connection to hc ended.");
  });
  it("says contr cannot read hc's data when it is not JSON", () =>
    expect(terminalProblem("hc sent data that is not JSON")).toBe("hc sent data that contr cannot read."));
  it("falls back for another error", () => expect(terminalProblem("bad hello")).toBe("The terminal could not attach to hc."));
});
