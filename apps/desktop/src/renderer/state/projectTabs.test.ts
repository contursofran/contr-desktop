import { afterEach, describe, expect, it, vi } from "vitest";
import { editProject, migrateTabs, readTabs, savedTerminals, saveTabs, tabProject, visibleTabs } from "./projectTabs";

const members = new Map([
  ["a", { project: "project:A", worker: false }],
  ["worker", { project: "project:A", worker: true }],
  ["b", { project: "project:A", worker: false }],
  ["c", { project: "project:B", worker: false }],
]);

function store(value: string | null) {
  const values = new Map(value === null ? [] : [["tabs.open", value]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, json: string) => values.set(key, json),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("project tabs", () => {
  it("loads the mixed legacy order once, preserving unmatched terminals", () => {
    store('["c","b","worker","a","shell",3]');
    const tabs = migrateTabs(readTabs(), members);
    saveTabs(tabs);
    const restored = readTabs();
    expect(restored).toEqual(tabs);
    expect(migrateTabs(restored, members)).toBe(restored);
    expect(savedTerminals(restored)).toEqual(["shell", "c", "b", "a"]);
    expect(visibleTabs(restored, members, "project:A", "a")).toEqual(["b", "a"]);
    expect(visibleTabs(restored, members, "project:B", "c")).toEqual(["c"]);
    expect(visibleTabs(restored, members, "", "shell")).toEqual(["shell"]);
  });

  it("shows sidebar order, closes per project, and shows only the current worker", () => {
    store(null);
    const tabs = readTabs();
    expect(visibleTabs(tabs, members, "project:A", "a")).toEqual(["a", "b"]);
    const closed = editProject(tabs, "project:A", (project) => ({ ...project, closed: ["a"] }));
    saveTabs(closed);
    const restored = readTabs();
    expect(tabProject(restored, members, "worker")).toBe("project:A");
    expect(visibleTabs(restored, members, "project:A", "worker")).toEqual(["b", "worker"]);
    expect(visibleTabs(restored, members, "project:A", "b")).toEqual(["b"]);
    expect(visibleTabs(restored, members, "project:B", "c")).toEqual(["c"]);
  });

  it.each([null, "{not json", '{"a":1}'])("uses empty state for %s", (value) => {
    store(value);
    expect(readTabs()).toEqual({ projects: {}, legacy: [] });
  });
});
