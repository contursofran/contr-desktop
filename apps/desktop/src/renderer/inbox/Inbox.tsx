import { useEffect, useState } from "react";
import type { OwnerItems, SidebarAgent } from "../../shared/api";
import { StateMark } from "../chat/blocks/Marks";
import { inboxItems } from "./order";
import { Note, Question, Todo, useSavedNote } from "../chat/owner/OwnerCards";

/** Why the last read of the owner items failed, or null after a good read. */
function useOwnerError(): string | null {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void window.contr.ownerError().then(setError);
    return window.contr.onOwnerError(setError);
  }, []);
  return error;
}

/**
 * The Inbox in the main pane: first the agents blocked on a prompt (a press opens the agent's chat with its card),
 * then every open item of every coordinator, each card under its coordinator's name.
 * While the last read of the owner items failed, a line in the Change log's failure look says why; the items are the last good read.
 */
export function Inbox({ items, blocked, name, onOpen }: { items: OwnerItems; blocked: SidebarAgent[]; name: (coordinator: string) => string; onOpen: (terminal: string) => void }) {
  const [note, setNote] = useSavedNote();
  const error = useOwnerError();
  const list = inboxItems(items);
  return (
    <section aria-label="Inbox" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {note && <Note text={note} />}
      {error && <p role="alert" className="mx-auto mb-3 w-full max-w-3xl text-xs text-error">Cannot read the owner items: {error}</p>}
      {list.length === 0 && blocked.length === 0 && !note && !error && <p className="mx-auto w-full max-w-3xl text-sm text-muted">Nothing needs you.</p>}
      {blocked.map((a) => (
        <div key={a.terminal} data-item={a.terminal} className="mx-auto mb-3 w-full max-w-3xl">
          <button
            type="button"
            onClick={() => onOpen(a.terminal)}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-raised px-3 py-2 text-left text-[13px] hover:bg-hover"
          >
            <StateMark state="blocked" label="blocked" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.title || a.name || a.terminal}</span>
            <span className="shrink-0 text-xs text-muted">Waits on a prompt</span>
          </button>
        </div>
      ))}
      {list.map(({ kind, item }) => (
        <div key={item.id} data-item={item.id}>
          <p className="mx-auto mb-1 w-full max-w-3xl text-xs font-medium text-muted">{name(item.coordinator)}</p>
          {kind === "question" ? <Question q={item} rest={0} onSaved={setNote} keys={false} /> : <Todo t={item} rest={0} onSaved={setNote} />}
        </div>
      ))}
    </section>
  );
}
