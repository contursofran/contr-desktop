import { describe, expect, it } from "vitest";
import { inboxCount, ownerResult, parseOwnerOpen, windowTitle } from "./owner";

describe("parseOwnerOpen", () => {
  it("gives questions with the recommended option first, and to-dos", () => {
    const items = parseOwnerOpen(JSON.stringify([
      { kind: "question", id: "D7", coordinator: "hc:t7", title: "Base", from: "b-15", question: "Which?", options: ["a", "b"], impacts: ["ia", "ib"], recommended: 1, refs: ["#15", 3] },
      { kind: "todo", id: "T3", coordinator: "t7", from: "b-2", todo_kind: "know", text: "Read `x`" },
    ]));
    expect(items.questions).toEqual([{ id: "D7", coordinator: "t7", order: 0, title: "Base", from: "b-15", question: "Which?", refs: ["#15"],
      options: [{ label: "b", impact: "ib", recommended: true }, { label: "a", impact: "ia", recommended: false }] }]);
    expect(items.todos).toEqual([{ id: "T3", coordinator: "t7", order: 1, from: "b-2", text: "Read `x`", know: true }]);
  });
  it("skips items with no id, coordinator or text, and output that is not a list", () => {
    expect(parseOwnerOpen(JSON.stringify([{ id: "D1", question: "q" }, { id: "T1", kind: "todo", coordinator: "t1" }, { coordinator: "t1", question: "q" }]))).toEqual({ questions: [], todos: [] });
    expect(parseOwnerOpen("not json")).toEqual({ questions: [], todos: [] });
    expect(parseOwnerOpen("{}")).toEqual({ questions: [], todos: [] });
  });
});

describe("ownerResult", () => {
  it("is ok on exit 0", () => expect(ownerResult(0, "", "Saved")).toEqual({ ok: true, note: null }));
  it("keeps the card with the tool's message on a failed run", () => expect(ownerResult(1, "no such item D9\n", "Saved")).toEqual({ ok: false, note: "no such item D9" }));
  it("says saved when the coordinator was not reached", () =>
    expect(ownerResult(1, "coordinator not reached: t7", "The answer is saved")).toEqual({ ok: true, note: "The answer is saved, but the coordinator did not get it: coordinator not reached: t7" }));
  it("counts the open items for the Inbox, the title and the badge", () => {
    const items = parseOwnerOpen(JSON.stringify([{ id: "D1", coordinator: "t1", question: "q" }, { kind: "todo", id: "T1", coordinator: "t2", text: "x" }]));
    expect(inboxCount(items)).toBe(2);
    expect(inboxCount({ questions: [], todos: [] })).toBe(0);
  });
  it("puts the count in the window title only while items are open", () => {
    expect(windowTitle(0)).toBe("contr");
    expect(windowTitle(3)).toBe("contr · Inbox 3");
  });
});
