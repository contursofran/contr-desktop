import { describe, expect, it } from "vitest";
import { orchestratingText, showsOrchestrate } from "./StatusLine";

describe("orchestratingText", () => {
  it("names the live workers, and is empty with none", () => {
    expect(orchestratingText(0)).toBeUndefined();
    expect(orchestratingText(1)).toBe("Orchestrating · 1 worker");
    expect(orchestratingText(3)).toBe("Orchestrating · 3 workers");
  });
});

describe("showsOrchestrate", () => {
  it("shows for Claude Code and native Codex chats with no workers", () => {
    expect(showsOrchestrate("claude", 0)).toBe(true);
    expect(showsOrchestrate("claude", 2)).toBe(false);
    expect(showsOrchestrate("codex", 0)).toBe(false);
    expect(showsOrchestrate("codex", 0, true)).toBe(true);
    expect(showsOrchestrate("codex", 2, true)).toBe(false);
    expect(showsOrchestrate(undefined, 0)).toBe(false);
  });
});
