import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OwnerItems, OwnerQuestion, OwnerResult, OwnerTodo } from "../../../shared/api";
import { useKeys } from "../card/Card";
import { ChatMarkdown } from "../markdown/ChatMarkdown";
import { splitTodo } from "./blocks";

/** "saved, coordinator not reached" shows alone this long after the item leaves. */
const SAVED_NOTE_MS = 15_000;
/** A copy button shows its check this long. */
const COPY_MS = 1_500;

const box = "mx-auto mb-2 w-full max-w-3xl rounded-lg border border-border bg-raised p-3 text-sm";
const button = "flex items-center gap-2 rounded-md border border-border px-3 py-1 hover:bg-hover disabled:opacity-50";
const primary = `${button} bg-foreground text-canvas hover:bg-foreground`;
const key = "rounded bg-selected px-1.5 font-mono text-xs text-muted";
const more = (n: number) => (n > 0 ? ` · ${n} more after this` : "");

/** All open owner items of every coordinator, from `owner open --json`. */
export function useAllOwnerItems(): OwnerItems {
  const [items, setItems] = useState<OwnerItems>({ questions: [], todos: [] });
  useEffect(() => {
    void window.contr.owner().then(setItems);
    return window.contr.onOwner(setItems);
  }, []);
  return items;
}

/** The open owner items of `terminal` (its coordinator's chat). */
export function useOwnerItems(terminal: string): OwnerItems {
  const items = useAllOwnerItems();
  return { questions: items.questions.filter((q) => q.coordinator === terminal), todos: items.todos.filter((t) => t.coordinator === terminal) };
}

/** A note that stays after its item left: "saved, coordinator not reached", for 15 s. */
export function useSavedNote(): [string | null, (n: string) => void] {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [note, (n) => {
    setNote(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), SAVED_NOTE_MS);
  }];
}

/** The owner question card, then the owner to-do card: the oldest open item of each, one at a time. */
export function OwnerCards({ items }: { items: OwnerItems }) {
  const [qNote, setQNote] = useSavedNote();
  const [tNote, setTNote] = useSavedNote();
  const q = items.questions[0];
  const t = items.todos[0];
  return (
    <>
      {q ? <Question key={q.id} q={q} rest={items.questions.length - 1} onSaved={setQNote} /> : qNote && <Note text={qNote} />}
      {t ? <Todo key={t.id} t={t} rest={items.todos.length - 1} onSaved={setTNote} /> : tNote && <Note text={tNote} />}
    </>
  );
}

export function Note({ text }: { text: string }) {
  return <p role="status" className={`${box} text-xs text-muted`}>{text}</p>;
}

/** Runs an owner action: a failed run keeps the card with the tool's message; a saved-not-reached note goes up. */
function useRun(onSaved: (n: string) => void) {
  const [off, setOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (call: () => Promise<OwnerResult>) => {
    if (off) return;
    setOff(true);
    const r = await call();
    if (!r.ok) {
      setError(r.note);
      setOff(false);
    } else if (r.note) onSaved(r.note);
  };
  return { off, error, go };
}

/** `keys` false: the digit and Enter keys do not answer (the Inbox shows many cards at once). */
export function Question({ q, rest, onSaved, keys = true }: { q: OwnerQuestion; rest: number; onSaved: (n: string) => void; keys?: boolean }) {
  const { off, error, go } = useRun(onSaved);
  const [other, setOther] = useState("");
  const otherRef = useRef<HTMLInputElement>(null);
  const send = (answer: string) => answer.trim() && void go(() => window.contr.ownerAnswer(q.id, answer.trim()));
  useKeys((k) => {
    if (!keys) return;
    const n = Number(k);
    if (n >= 1 && n <= q.options.length) send(q.options[n - 1]!.label);
    else if (n === q.options.length + 1) otherRef.current?.focus();
    else if (k === "Enter") send(other);
  });
  return (
    <section aria-label="Owner question" className={box}>
      <p className="text-xs text-muted">{q.id} · The coordinator asks{more(rest)}</p>
      {(q.title || q.from) && <p className="mt-1 text-xs text-muted">{[q.title, q.from && `from ${q.from}`].filter(Boolean).join(" · ")}</p>}
      <p className="mt-1 font-semibold">{q.question}</p>
      <div className="mt-2 flex flex-col gap-1">
        {q.options.map((o, i) => (
          <button key={o.label} type="button" disabled={off} onClick={() => send(o.label)} className={`${button} items-start text-left`}>
            <span className={key}>{i + 1}</span>
            <span className="flex flex-col">
              <span>{o.label}{o.recommended ? <span className="text-muted"> (Recommended)</span> : null}</span>
              {o.impact && <span className="text-xs text-muted">{o.impact}</span>}
            </span>
          </button>
        ))}
        <label className="flex items-center gap-2 px-3 py-1">
          <span className={key}>{q.options.length + 1}</span>
          <input
            ref={otherRef}
            aria-label="Own answer"
            placeholder="Type your own answer"
            disabled={off}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(other); } }}
            className="flex-1 bg-transparent outline-none placeholder:text-dim"
          />
        </label>
      </div>
      {q.refs.length > 0 && <p className="mt-2 text-xs text-muted">Refs: {q.refs.join(", ")}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-blocked">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button type="button" disabled={off || !other.trim()} onClick={() => send(other)} className={primary}>Send answer</button>
      </div>
    </section>
  );
}

export function Todo({ t, rest, onSaved }: { t: OwnerTodo; rest: number; onSaved: (n: string) => void }) {
  const { off, error, go } = useRun(onSaved);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPY_MS);
    });
  };
  const row = (id: string, code: string, block: boolean) => (
    <div key={id} className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-canvas px-2 py-1 font-[Menlo,monospace] text-[12.5px]">
      <span className={`min-w-0 flex-1 ${block ? "whitespace-pre-wrap" : "truncate"}`}>{code}</span>
      <button type="button" aria-label={copied === id ? "Copied" : `Copy ${code}`} onClick={() => copy(id, code)} className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-hover">
        {copied === id ? <CheckIcon className="size-3.5 text-foreground" /> : <CopyIcon className="size-3.5 text-muted" />}
      </button>
    </div>
  );
  return (
    <section aria-label="Owner to-do" className={box}>
      <p className="text-xs text-muted">{t.id} · {t.know ? "To know" : "To do"}{more(rest)}</p>
      {t.from && <p className="mt-1 text-[11.5px] text-muted">from {t.from}</p>}
      <div className="mt-1 text-[13.5px]">
        {splitTodo(t.text).map((b, i) =>
          b.kind === "code" ? row(`c${i}`, b.code, true) : (
            <div key={`p${i}`}>
              <ChatMarkdown text={b.text} />
              {b.spans.map((s, j) => row(`s${i}.${j}`, s, false))}
            </div>
          ),
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-blocked">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button type="button" disabled={off} onClick={() => void go(() => window.contr.ownerDone(t.id))} className={primary}>Done</button>
      </div>
    </section>
  );
}
