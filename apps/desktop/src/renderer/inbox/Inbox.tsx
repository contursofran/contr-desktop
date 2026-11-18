import { useEffect, useState, type ReactNode } from "react";
import type { OwnerItems, SidebarAgent } from "../../shared/api";
import { isCardKey } from "../chat/card/Card";
import { Note, useSavedNote } from "../chat/owner/OwnerCards";
import { StatusGlyph } from "../ui/StatusGlyph";
import { OpenQuestion, OpenTodo } from "./OpenItem";
import { inboxItems, openId, rowSub, rowText, type Item } from "./order";

/** Why the last read of the owner items failed, or null after a good read. */
function useOwnerError(): string | null {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void window.contr.ownerError().then(setError);
    return window.contr.onOwnerError(setError);
  }, []);
  return error;
}

/** Arrow Up and Down move the open item, from anywhere in the window but a text field or a menu. */
function useMoveKeys(list: Item[], open: string | null, setOpen: (id: string) => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || !isCardKey(event)) return;
      const at = list.findIndex((e) => e.item.id === open);
      const next = list[at + (event.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      setOpen(next.item.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [list, open, setOpen]);
}

const endText = "font-mono text-[11px] text-dim";

/**
 * A closed row: glyph, id, text, the line under it, and its end. A press on the row opens it.
 * `end` is text in the row's button; `action` is a button of its own after it.
 */
function Row({ item, glyph, id, text, sub, end, action, onPress }: { item: string; glyph: "blocked" | "idle"; id: string; text: string; sub: string; end?: string; action?: ReactNode; onPress: () => void }) {
  return (
    <div data-item={item} className="grid min-h-11 grid-cols-[16px_36px_1fr_auto] items-center gap-x-3 border-t border-hairline px-2.5 py-2 text-[13px]">
      <button type="button" onClick={onPress} className={`grid grid-cols-subgrid items-center text-left ${action ? "col-span-3" : "col-span-4"}`}>
        <StatusGlyph state={glyph} />
        <span className="font-mono text-[11px] text-dim">{id}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-ink-90">{text}</span>
          <span className="truncate text-[11.5px] text-dim">{sub}</span>
        </span>
        {end && <span className={endText}>{end}</span>}
      </button>
      {action}
    </div>
  );
}

/** "Done" at the end of a closed to-do row: marks it done, as the card's Done does. */
function DoneEnd({ id, onSaved }: { id: string; onSaved: (n: string) => void }) {
  const [off, setOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = async () => {
    setOff(true);
    const r = await window.contr.ownerDone(id);
    if (!r.ok) {
      setError(r.note);
      setOff(false);
    } else if (r.note) onSaved(r.note);
  };
  return (
    <span className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-blocked">{error}</span>}
      <button type="button" disabled={off} onClick={() => void done()} className={`${endText} rounded px-1 hover:text-ink-100 disabled:opacity-50`}>Done</button>
    </span>
  );
}

/**
 * The Inbox in the main pane: one row per open item of every coordinator, oldest first, then the agents blocked on a prompt.
 * One item is open, and its row is the card (the oldest, until the owner opens another with a press or Arrow Up and Down); the card takes the digit and Enter keys.
 * A blocked agent's row opens the agent's chat with its card.
 * While the last read of the owner items failed, a line says why; the items are the last good read.
 */
export function Inbox({ items, blocked, name, onOpen }: { items: OwnerItems; blocked: SidebarAgent[]; name: (coordinator: string) => string; onOpen: (terminal: string) => void }) {
  const [note, setNote] = useSavedNote();
  const error = useOwnerError();
  const list = inboxItems(items);
  const [want, setWant] = useState<string | null>(null);
  const open = openId(list, want);
  useMoveKeys(list, open, setWant);
  useEffect(() => {
    if (open) document.querySelector(`[data-item="${CSS.escape(open)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open]);
  const count = list.length + blocked.length;
  return (
    <section aria-label="Inbox" className="min-h-0 flex-1 overflow-y-auto px-14 pt-7 pb-5">
      <div className="mx-auto flex w-full max-w-[760px] flex-col">
        <div className="flex items-baseline gap-3 pb-3.5">
          <h1 className="text-base font-semibold text-ink-100">Inbox</h1>
          {count > 0 && <span className="font-mono text-[11px] text-dim">{count} open · oldest first</span>}
        </div>
        {note && <Note text={note} />}
        {error && <p role="alert" className="mb-3 text-xs text-error">Cannot read the owner items: {error}</p>}
        {count === 0 && !note && !error && <p className="text-sm text-muted">Nothing needs you.</p>}
        {list.map((entry) => {
          const { item } = entry;
          if (item.id === open) {
            const sub = rowSub(entry, name(item.coordinator));
            return entry.kind === "question"
              ? <OpenQuestion key={item.id} q={entry.item} sub={sub} onSaved={setNote} />
              : <OpenTodo key={item.id} t={entry.item} sub={sub} onSaved={setNote} />;
          }
          const n = entry.kind === "question" ? entry.item.options.length : 0;
          return (
            <Row
              key={item.id}
              item={item.id}
              glyph={entry.kind === "question" ? "blocked" : "idle"}
              id={item.id}
              text={rowText(entry)}
              sub={rowSub(entry, name(item.coordinator))}
              onPress={() => setWant(item.id)}
              end={entry.kind === "question" ? (n === 1 ? "1 answer" : `${n} answers`) : undefined}
              action={entry.kind === "todo" ? <DoneEnd id={item.id} onSaved={setNote} /> : undefined}
            />
          );
        })}
        {blocked.map((a) => (
          <Row key={a.terminal} item={a.terminal} glyph="blocked" id="" text={a.title || a.name || a.terminal} sub="Waits on a prompt" end="Open chat" onPress={() => onOpen(a.terminal)} />
        ))}
      </div>
    </section>
  );
}
