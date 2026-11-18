import type { OwnerItems, OwnerQuestion, OwnerTodo } from "../../shared/api";

export type Item = { kind: "question"; item: OwnerQuestion } | { kind: "todo"; item: OwnerTodo };

/** Questions and to-dos in one list, oldest first (their place in `owner open --json`). */
export function inboxItems(items: OwnerItems): Item[] {
  const all: Item[] = [...items.questions.map((item) => ({ kind: "question" as const, item })), ...items.todos.map((item) => ({ kind: "todo" as const, item }))];
  return all.sort((a, b) => a.item.order - b.item.order);
}

/** The one line of a closed row: the item's first line of text, with no bold or code marks. */
export function rowText(entry: Item): string {
  if (entry.kind === "question") return entry.item.question;
  const line = entry.item.text.split("\n").find((l) => l.trim()) ?? "";
  return line.replace(/\*\*|__|`/g, "").trim();
}

/** The line under a closed row's text: kind, title, where it is from, and the coordinator's name. */
export function rowSub(entry: Item, coordinator: string): string {
  const kind = entry.kind === "question" ? "Question" : entry.item.know ? "To know" : "To do";
  const title = entry.kind === "question" ? entry.item.title : "";
  return [kind, title, entry.item.from && `from ${entry.item.from}`, coordinator].filter(Boolean).join(" · ");
}

/** The id of the open item: `want` while it is in the list, else the oldest item. */
export function openId(list: Item[], want: string | null): string | null {
  return list.find((e) => e.item.id === want)?.item.id ?? list[0]?.item.id ?? null;
}
