import { describe, expect, it } from "vitest";
import { orchestratingText } from "./StatusLine";

describe("orchestratingText", () => {
  it("names the live workers, and is empty with none", () => {
    expect(orchestratingText(0)).toBeUndefined();
    expect(orchestratingText(1)).toBe("Orchestrating · 1 worker");
    expect(orchestratingText(3)).toBe("Orchestrating · 3 workers");
  });
});
