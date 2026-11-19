import { describe, expect, it } from "vitest";
import type { Sidebar } from "../../shared/api";
import { readShown, readSide, saveShown, saveSide, startAgent } from "./restart";

const store = (entries: Record<string, string> = {}) => {
  const m = new Map(Object.entries(entries));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const agent = (terminal: string, workers: Sidebar["projects"][0]["agents"] = []) => ({ terminal, title: terminal, name: null, kind: null, issue: null, state: "idle" as const, workers });
const project = (agents: Sidebar["projects"][0]["agents"]) => ({ name: "p", cwd: "", branch: null, ahead: 0, behind: 0, favicon: null, agents });
const data = (selected = ""): Sidebar => ({ selected, projects: [project([]), project([agent("t7", [agent("t8")]), agent("t12")])] });

describe("restart state", () => {
  it("reads back the shown agent and the pick it saved", () => {
    const s = store();
    saveShown("t12", s);
    saveSide("terminal", s);
    expect(readShown(s)).toBe("t12");
    expect(readSide(s)).toBe("terminal");
  });
  it("gives no agent and Chat with no stored value", () => {
    expect(readShown(store())).toBe("");
    expect(readSide(store())).toBe("chat");
  });
  it("gives Chat for a bad stored pick", () => {
    expect(readSide(store({ "view.side": "sideways" }))).toBe("chat");
  });
  it("shows the stored agent while the sidebar lists it, a worker too", () => {
    expect(startAgent(data(), "t12")).toBe("t12");
    expect(startAgent(data("t7"), "t8")).toBe("t8");
  });
  it("shows main's agent, else the first listed agent, when the stored one is gone or there is none", () => {
    expect(startAgent(data("t12"), "t99")).toBe("t12");
    expect(startAgent(data(), "t99")).toBe("t7");
    expect(startAgent(data(), "")).toBe("t7");
    expect(startAgent({ selected: "", projects: [] }, "t7")).toBe("");
  });
});
