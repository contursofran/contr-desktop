import { describe, expect, it } from "vitest";
import { inboxItems } from "./order";
import { blockedAgents } from "../../shared/inbox";
import type { SidebarAgent, WorkerState } from "../../shared/api";

describe("inboxItems", () => {
  it("puts questions and to-dos in one list, oldest first", () => {
    const q = (id: string, order: number) => ({ id, coordinator: "t7", order, title: "", from: "", question: "q", options: [], refs: [] });
    const t = (id: string, order: number) => ({ id, coordinator: "t12", order, from: "", text: "x", know: false });
    const list = inboxItems({ questions: [q("D1", 0), q("D2", 3)], todos: [t("T1", 1), t("T2", 2)] });
    expect(list.map((i) => `${i.kind}:${i.item.id}`)).toEqual(["question:D1", "todo:T1", "todo:T2", "question:D2"]);
  });
  it("gives an empty list with no items", () => expect(inboxItems({ questions: [], todos: [] })).toEqual([]));
});

describe("blockedAgents", () => {
  const a = (terminal: string, state: WorkerState, workers: SidebarAgent[] = []): SidebarAgent => ({ terminal, title: terminal, name: null, state, kind: null, issue: null, workers });
  const project = (agents: SidebarAgent[]) => ({ name: "p", agents, cwd: "/p", branch: null, ahead: 0, behind: 0, favicon: null });
  it("lists blocked agents and workers in sidebar order", () => {
    const list = blockedAgents([project([a("t1", "blocked", [a("t2", "working"), a("t3", "blocked")]), a("t4", "done")]), project([a("t5", "blocked")])]);
    expect(list.map((x) => x.terminal)).toEqual(["t1", "t3", "t5"]);
  });
  it("gives an empty list when no agent waits", () => expect(blockedAgents([project([a("t1", "done")])])).toEqual([]));
});
