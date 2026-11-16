import type { OwnerItems } from "../../shared/api";
import { inboxItems } from "./order";
import { Note, Question, Todo, useSavedNote } from "../chat/owner/OwnerCards";

/** The Inbox in the main pane: every open item of every coordinator, each card under its coordinator's name. */
export function Inbox({ items, name }: { items: OwnerItems; name: (coordinator: string) => string }) {
  const [note, setNote] = useSavedNote();
  const list = inboxItems(items);
  return (
    <section aria-label="Inbox" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {note && <Note text={note} />}
      {list.length === 0 && !note && <p className="mx-auto w-full max-w-3xl text-sm text-muted">Nothing needs you.</p>}
      {list.map(({ kind, item }) => (
        <div key={item.id} data-item={item.id}>
          <p className="mx-auto mb-1 w-full max-w-3xl text-xs font-medium text-muted">{name(item.coordinator)}</p>
          {kind === "question" ? <Question q={item} rest={0} onSaved={setNote} keys={false} /> : <Todo t={item} rest={0} onSaved={setNote} />}
        </div>
      ))}
    </section>
  );
}
