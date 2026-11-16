import { describe, expect, it } from "vitest";
import type { Sidebar } from "../../shared/api";
import { findAgent, nextAfterClose, openTab } from "./TopBar";

const agent = (terminal: string, title: string, workers: Sidebar["projects"][0]["agents"] = []) => ({ terminal, title, name: null, kind: null, issue: null, state: "idle" as const, workers });

describe("top bar tabs", () => {
  it("opens the selected agent's tab once, at the end", () => {
    expect(openTab([], "t7")).toEqual(["t7"]);
    expect(openTab(["t7"], "t12")).toEqual(["t7", "t12"]);
    expect(openTab(["t7", "t12"], "t7")).toEqual(["t7", "t12"]);
    expect(openTab(["t7"], "")).toEqual(["t7"]);
  });
  it("shows the next tab after a close, else the one before, else none", () => {
    expect(nextAfterClose(["a", "b", "c"], "b")).toBe("c");
    expect(nextAfterClose(["a", "b", "c"], "c")).toBe("b");
    expect(nextAfterClose(["a"], "a")).toBe("");
  });
  it("finds a worker's title in the tree", () => {
    const data: Sidebar = { selected: "", projects: [{ name: "p", cwd: "", branch: null, ahead: 0, behind: 0, favicon: null, agents: [agent("t7", "Orch", [agent("t8", "Worker")])] }] };
    expect(findAgent(data, "t8")?.title).toBe("Worker");
    expect(findAgent(data, "t9")).toBeUndefined();
  });
});
