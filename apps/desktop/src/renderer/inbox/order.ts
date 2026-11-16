import type { OwnerItems, OwnerQuestion, OwnerTodo } from "../../shared/api";

export type Item = { kind: "question"; item: OwnerQuestion } | { kind: "todo"; item: OwnerTodo };

/** Questions and to-dos in one list, oldest first (their place in `owner open --json`). */
export function inboxItems(items: OwnerItems): Item[] {
  const all: Item[] = [...items.questions.map((item) => ({ kind: "question" as const, item })), ...items.todos.map((item) => ({ kind: "todo" as const, item }))];
  return all.sort((a, b) => a.item.order - b.item.order);
}

