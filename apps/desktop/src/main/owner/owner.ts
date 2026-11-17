import type { OwnerItems, OwnerQuestion, OwnerResult, OwnerTodo } from "../../shared/api";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** "hc:t2" → "t2": the key that an item's `coordinator` and an agent's terminal share. */
const local = (address: unknown): string => str(address).replace(/^hc:/, "");

/**
 * The open items of `owner open --json`, oldest first as the tool gives them.
 * An item with no id, no coordinator or no text gives nothing. Output that is not a JSON list gives no items.
 */
export function parseOwnerOpen(json: string): OwnerItems {
  return itemsOf(jsonList(json) ?? []);
}

function jsonList(json: string): unknown[] | null {
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/**
 * One read of `owner open --json` (stdout, and why the run failed or null).
 * A failed run or output that is not a JSON list keeps `last`, the last good list, and gives why; it is not "nothing is open".
 */
export function readOwnerOpen(last: OwnerItems, out: string, error: string | null): { items: OwnerItems; error: string | null } {
  if (error) return { items: last, error };
  const list = jsonList(out);
  return list ? { items: itemsOf(list), error: null } : { items: last, error: "herdr-contr-orch gave no JSON list" };
}

function itemsOf(list: unknown[]): OwnerItems {
  const out: OwnerItems = { questions: [], todos: [] };
  for (const [order, raw] of (list as Record<string, unknown>[]).entries()) {
    const id = str(raw?.id);
    const coordinator = local(raw?.coordinator);
    if (!id || !coordinator) continue;
    if (raw.kind === "todo") {
      const text = str(raw.text);
      if (text) out.todos.push({ id, coordinator, order, from: str(raw.from), text, know: raw.todo_kind === "know" } satisfies OwnerTodo);
      continue;
    }
    const question = str(raw.question);
    if (!question) continue;
    const impacts = Array.isArray(raw.impacts) ? raw.impacts : [];
    const options = (Array.isArray(raw.options) ? raw.options : []).map((label, i) => ({ label: str(label), impact: str(impacts[i]), recommended: raw.recommended === i }));
    const rec = options.findIndex((o) => o.recommended);
    if (rec > 0) options.unshift(...options.splice(rec, 1));
    const refs = (Array.isArray(raw.refs) ? raw.refs : []).map(str).filter(Boolean);
    out.questions.push({ id, coordinator, order, title: str(raw.title), from: str(raw.from), question, options, refs } satisfies OwnerQuestion);
  }
  return out;
}

/**
 * The result of `owner answer` or `owner done` from its exit code and stderr.
 * A failed run whose message says "coordinator not reached" saved the change: the item leaves, and the note says so.
 */
export function ownerResult(code: number | null, stderr: string, saved: string): OwnerResult {
  if (code === 0) return { ok: true, note: null };
  const why = stderr.trim() || "herdr-contr-orch failed";
  if (code != null && /coordinator not reached/.test(why)) return { ok: true, note: `${saved}, but the coordinator did not get it: ${why}` };
  return { ok: false, note: why };
}

/** The number of open items: the Inbox count, the window title and the Dock badge. */
export const inboxCount = (items: OwnerItems): number => items.questions.length + items.todos.length;

/** The window title: "contr", and "contr · Inbox N" while items are open. */
export const windowTitle = (n: number): string => (n > 0 ? `contr · Inbox ${n}` : "contr");
