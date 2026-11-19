import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OwnerItems, OwnerQuestion, OwnerTodo } from "../../../shared/api";
import { CardHead, CardText, cardBox } from "../card/Card";
import { ChatMarkdown } from "../markdown/ChatMarkdown";
import { splitTodo, todoCommands } from "./blocks";
import { OwnerQuestionAnswers, useOwnerRun } from "./OwnerQuestionAnswers";

/** "saved, coordinator not reached" shows alone this long after the item leaves. */
const SAVED_NOTE_MS = 15_000;
/** A copy button shows its check this long. */
const COPY_MS = 1_500;

const box = "mx-auto mb-2 w-full max-w-read rounded-lg border border-border bg-raised p-3 text-sm";
const button = "flex items-center gap-2 rounded-md border border-border px-3 py-1 hover:bg-hover disabled:opacity-50";
const primary = `${button} bg-foreground text-canvas hover:bg-foreground`;
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

/**
 * The owner question card, then the owner to-do card: the oldest open item of each, one at a time.
 * `keys` false: the agent's card owns the card keys, so the question takes none and shows no key badges.
 */
export function OwnerCards({ items, keys = true }: { items: OwnerItems; keys?: boolean }) {
  const [qNote, setQNote] = useSavedNote();
  const [tNote, setTNote] = useSavedNote();
  const q = items.questions[0];
  const t = items.todos[0];
  return (
    <>
      {q ? <Question key={q.id} q={q} rest={items.questions.length - 1} onSaved={setQNote} keys={keys} /> : qNote && <Note text={qNote} />}
      {t ? <TodoRow key={t.id} t={t} onSaved={setTNote} /> : tNote && <Note text={tNote} />}
    </>
  );
}

export function Note({ text }: { text: string }) {
  return <p role="status" className={`${box} text-xs text-muted`}>{text}</p>;
}

function Question({ q, rest, onSaved, keys }: { q: OwnerQuestion; rest: number; onSaved: (n: string) => void; keys: boolean }) {
  const head = [q.title, q.from && `from ${q.from}`].filter(Boolean).join(" · ");
  return (
    <section aria-label="Owner question" className={cardBox}>
      <CardHead><span className="font-mono text-[11px]">{q.id}</span> · The coordinator asks{head && ` · ${head}`}{more(rest)}</CardHead>
      <CardText>{q.question}</CardText>
      <OwnerQuestionAnswers q={q} onSaved={onSaved} keys={keys} errorColor="text-blocked">
        {q.refs.length > 0 && (
          <p className="flex flex-wrap items-baseline gap-x-2 px-3 pt-1.5 pb-0.5 text-xs text-dim">
            <span>Refs</span>
            {q.refs.map((r) => <span key={r} className="font-mono text-[11px] text-muted">{r}</span>)}
          </p>
        )}
      </OwnerQuestionAnswers>
    </section>
  );
}

/** The to-do's text with a copy row for each command (the Inbox card, and the chat row after "Show"). */
function TodoBody({ t }: { t: OwnerTodo }) {
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
    <div key={id} className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-canvas px-2 py-1 font-mono text-[12.5px]">
      <span className={`min-w-0 flex-1 ${block ? "whitespace-pre-wrap" : "truncate"}`}>{code}</span>
      <button type="button" aria-label={copied === id ? "Copied" : `Copy ${code}`} onClick={() => copy(id, code)} className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-hover">
        {copied === id ? <CheckIcon className="size-3.5 text-foreground" /> : <CopyIcon className="size-3.5 text-muted" />}
      </button>
    </div>
  );
  return (
    <div className="text-[13.5px]">
      {splitTodo(t.text).map((b, i) =>
        b.kind === "code" ? row(`c${i}`, b.code, true) : (
          <div key={`p${i}`}>
            <ChatMarkdown text={b.text} />
            {b.spans.map((s, j) => row(`s${i}.${j}`, s, false))}
          </div>
        ),
      )}
    </div>
  );
}

/** The Inbox's to-do card: the whole text and its commands. */
export function Todo({ t, rest, onSaved }: { t: OwnerTodo; rest: number; onSaved: (n: string) => void }) {
  const { off, error, go } = useOwnerRun(onSaved);
  return (
    <section aria-label="Owner to-do" className={box}>
      <p className="text-xs text-muted">{t.id} · {t.know ? "To know" : "To do"}{more(rest)}</p>
      {t.from && <p className="mt-1 text-[11.5px] text-muted">from {t.from}</p>}
      <div className="mt-1"><TodoBody t={t} /></div>
      {error && <p role="alert" className="mt-2 text-xs text-blocked">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button type="button" disabled={off} onClick={() => void go(() => window.contr.ownerDone(t.id))} className={primary}>Done</button>
      </div>
    </section>
  );
}

/** A mock button (screens.html `.btn`). */
const rowButton = "flex h-7 shrink-0 items-center rounded-lg px-3 text-[12.5px] whitespace-nowrap text-ink-90 shadow-[inset_0_0_0_1px_var(--input-line)] hover:bg-hover disabled:opacity-50";

/**
 * The chat's to-do: one row (screens.html screen 1, `.todo`): the id, the first paragraph cut to one line, the kind,
 * who sent it and the number of commands, then Show and Done. Show opens the whole text with its copy rows in place.
 */
export function TodoRow({ t, onSaved }: { t: OwnerTodo; onSaved: (n: string) => void }) {
  const { off, error, go } = useOwnerRun(onSaved);
  const [open, setOpen] = useState(false);
  const blocks = splitTodo(t.text);
  const first = blocks.find((b) => b.kind === "text");
  const commands = todoCommands(blocks);
  const meta = [t.know ? "To know" : "To do", t.from && `from ${t.from}`, commands > 0 && `${commands} ${commands === 1 ? "command" : "commands"}`].filter(Boolean).join(" · ");
  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<section aria-label="Owner to-do" className="mx-auto mb-2 flex w-full max-w-read flex-col gap-2 rounded-xl border border-border bg-chrome py-2 pr-2 pl-3.5" />}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 font-mono text-[11px] text-dim">{t.id}</span>
        <div className="min-w-0 flex-1 [&_.chat-markdown]:truncate [&_.chat-markdown]:text-[13.5px] [&_.chat-markdown]:leading-[21px] [&_.chat-markdown]:text-ink-90 [&_.chat-markdown_p]:m-0 [&_.chat-markdown_p]:inline">
          {first && first.kind === "text" && <ChatMarkdown text={first.text} />}
        </div>
        <span className="shrink-0 text-[11.5px] whitespace-nowrap text-dim">{meta}</span>
        <CollapsibleTrigger className={rowButton}>{open ? "Hide" : "Show"}</CollapsibleTrigger>
        <button type="button" disabled={off} onClick={() => void go(() => window.contr.ownerDone(t.id))} className={rowButton}>Done</button>
      </div>
      <CollapsiblePanel><TodoBody t={t} /></CollapsiblePanel>
      {error && <p role="alert" className="text-xs text-blocked">{error}</p>}
    </Collapsible>
  );
}
