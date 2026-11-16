import { describe, expect, it } from "vitest";
import { inboxItems } from "./order";

describe("inboxItems", () => {
  it("puts questions and to-dos in one list, oldest first", () => {
    const q = (id: string, order: number) => ({ id, coordinator: "t7", order, title: "", from: "", question: "q", options: [], refs: [] });
    const t = (id: string, order: number) => ({ id, coordinator: "t12", order, from: "", text: "x", know: false });
    const list = inboxItems({ questions: [q("D1", 0), q("D2", 3)], todos: [t("T1", 1), t("T2", 2)] });
    expect(list.map((i) => `${i.kind}:${i.item.id}`)).toEqual(["question:D1", "todo:T1", "todo:T2", "question:D2"]);
  });
  it("gives an empty list with no items", () => expect(inboxItems({ questions: [], todos: [] })).toEqual([]));
});
