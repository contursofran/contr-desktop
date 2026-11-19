import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sidebar } from "../../shared/api";
import { findAgent, nextAfterClose, openTab, readTabs, saveTabs, tabLabel, scrollToShow } from "./TopBar";

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
  it("labels a tab with the sidebar title, else the title from hc, never the terminal id", () => {
    const data: Sidebar = { selected: "", projects: [{ name: "p", cwd: "", branch: null, ahead: 0, behind: 0, favicon: null, agents: [agent("t7", "Orch")] }] };
    expect(tabLabel(data, "t7", { t7: { title: "Other" } })).toBe("Orch");
    expect(tabLabel(data, "t9", { t9: { title: "Claude Code" } })).toBe("Claude Code");
    expect(tabLabel(data, "t9", {})).toBe("");
  });
});

describe("saved tab order", () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = (value: string | null) => {
    const m = new Map<string, string>(value === null ? [] : [["tabs.open", value]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) });
    return m;
  };

  it("reads back the order it saved", () => {
    store(null);
    saveTabs(["t2", "t7"]);
    expect(readTabs()).toEqual(["t2", "t7"]);
  });

  it("reads none when nothing or something broken is saved", () => {
    store(null);
    expect(readTabs()).toEqual([]);
    store("{not json");
    expect(readTabs()).toEqual([]);
    store('{"a":1}');
    expect(readTabs()).toEqual([]);
    store('["t1", 3]');
    expect(readTabs()).toEqual(["t1"]);
  });
});

describe("scrollToShow", () => {
  const row = { width: 300, scroll: 100 };
  it("keeps the scroll when the tab is in view", () => expect(scrollToShow(row, { left: 150, width: 100 })).toBe(100));
  it("scrolls left to a tab cut at the left", () => expect(scrollToShow(row, { left: 60, width: 100 })).toBe(60));
  it("scrolls right just enough for a tab cut at the right", () => expect(scrollToShow(row, { left: 350, width: 120 })).toBe(170));
  it("shows a tab wider than the row from its start", () => expect(scrollToShow(row, { left: 350, width: 400 })).toBe(350));
});
