import { CheckIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Card as CardData, PromptResult, QuestionCard, Sidebar } from "../../../shared/api";
import { duration } from "../../sidebar/ages";
import { findAgent } from "../../topbar/TopBar";
import { StatusGlyph } from "../../ui/StatusGlyph";

/** The note for a `done` result that is not `sent` (docs/reference/helper-protocol.md, `done`). */
export function resultNote(r: PromptResult): string {
  if (r.result === "sent") return "Answer sent. Waiting for the agent.";
  if (r.result === "changed") return "It changed on screen. Here is what it shows now.";
  if (r.result === "unconfirmed") return "Sent. The agent did not confirm it yet.";
  return r.message ?? r.result;
}

/** Where a key is text: the reply box and other text fields, and a menu's typeahead. */
const TYPING = "textarea, input, select, [contenteditable]:not([contenteditable=false]), [role=menu], [role=listbox], [role=combobox]";
/** Where Enter is the control's own key: a focused button or link outside the cards presses itself. */
const CONTROL = "button, a[href], summary, [role=button], [role=tab], [role=link]";

/**
 * True when a key press is for the card (owner's rule, issue #101): a number key answers always, except while
 * the owner types in a text field or a menu. Enter goes on only when the focus is on no control.
 */
export function isCardKey(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false;
  if (target?.closest?.(TYPING)) return false;
  return event.key !== "Enter" || !target?.closest?.(CONTROL);
}

/** True when `Card` shows `card`. A shown agent's card owns the card keys: it blocks the agent now (issue #139). */
export function cardShows(card: CardData | null | undefined): card is CardData {
  return !!card && !(card.kind === "question" && card.question.questions.length === 0);
}

/** The card above the reply box: answers the agent's approval prompt or question through the helper. */
export function Card({ card }: { card: CardData }) {
  if (!cardShows(card)) return null;
  return card.kind === "approval" ? <Approval key={card.request} card={card} /> : <Question key={card.request} request={card.request} question={card.question} />;
}

/*
 * The one question card (issue #182, docs/design/redesign/screens.html screens 1 and 2): permissions, agent
 * questions, pick-any questions and owner questions use these parts. It has the reply box's fill and line, no shadow.
 */
export const cardBox = "mx-auto mb-2 flex w-full max-w-read flex-col gap-0.5 rounded-xl border border-input-line bg-chrome p-3 text-sm";
/** One answer: the key or the check box, then the label and its detail. */
export const optionRow = "flex w-full items-start gap-3 rounded-[9px] px-3 py-2 text-left hover:bg-hover disabled:opacity-50";
export const keyMark = "mt-0.5 shrink-0 font-mono text-[11px] text-dim";
export const primaryButton = "flex h-7 shrink-0 items-center rounded-lg bg-selected px-3 text-[12.5px] text-ink-100 shadow-[inset_0_0_0_1px_var(--input-line)] disabled:opacity-50";
export const ownField = "h-[30px] min-w-0 flex-1 rounded-lg border border-input-line bg-transparent px-2.5 text-[12.5px] text-foreground outline-none placeholder:text-dim";

/** The head: the red glyph (the card needs the owner), then what asks. */
export function CardHead({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-[9px] px-3 pb-1.5 text-[11.5px] text-dim">
      <StatusGlyph state="blocked" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** The age of an agent's card: from the time it came to this chat. It draws again each 30 s, as the sidebar's ages do. */
function useAge(): string {
  const [since] = useState(Date.now);
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return duration(now - since);
}

/**
 * The head of an agent's card (chat-screen.html `.qh`): the agent's name in mono, its title and the card's age from the
 * sidebar's shown agent, then what the source says asks.
 */
function AgentHead({ source }: { source: string }) {
  const [sidebar, setSidebar] = useState<Sidebar | null>(null);
  useEffect(() => {
    void window.contr.sidebar().then(setSidebar);
    return window.contr.onSidebar(setSidebar);
  }, []);
  const agent = sidebar ? findAgent(sidebar, sidebar.selected) : undefined;
  const age = useAge();
  const name = agent?.name && agent.name !== agent.title ? agent.name : null;
  return (
    <CardHead>
      {name && <span className="mr-[9px] font-mono text-[11px]">{name}</span>}
      {[agent?.title, age, source].filter(Boolean).join(" · ")}
    </CardHead>
  );
}

export function CardText({ children }: { children: ReactNode }) {
  return <p className="px-3 py-0.5 text-sm leading-5 text-ink-100">{children}</p>;
}

/** The label of an answer. "recommended" shows only where the source marks it. */
export function OptionLabel({ label, recommended }: { label: string; recommended?: boolean }) {
  return <span className="text-[13px] text-ink-90">{label}{recommended ? " · recommended" : ""}</span>;
}

/** The line under an answer's label (`.opt .d`). */
export function OptionDetail({ text }: { text: string }) {
  return <span className="mt-0.5 text-xs leading-[17px] text-dim">{text}</span>;
}

/** The pick-any check box. The button's `aria-pressed` gives the state; the box only shows it. */
function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`mt-0.5 grid size-3.5 shrink-0 place-items-center rounded ${on ? "bg-ink-85 text-canvas" : "shadow-[inset_0_0_0_1px_var(--ink-35)]"}`}>
      {on && <CheckIcon className="size-2.5" strokeWidth={3} />}
    </span>
  );
}

/** The keys that answer the card now. */
export function KeysLine({ text }: { text: string }) {
  return <span className="whitespace-pre pr-1.5 font-mono text-[11px] text-dim">{text}</span>;
}

export function CardNote({ children }: { children: ReactNode }) {
  return <p role="status" className="px-3 pt-1 text-xs text-muted">{children}</p>;
}

/** "1-n" for the keys line. */
export const keyRange = (n: number) => (n > 1 ? `1-${n}` : "1");

function Approval({ card }: { card: Extract<CardData, { kind: "approval" }> }) {
  const [note, setNote] = useState<string | null>(card.answered ? "Answer sent. Waiting for the agent." : null);
  const [off, setOff] = useState(card.answered);
  async function press(allow: boolean) {
    if (off) return;
    setOff(true);
    const r = await window.contr.approve(card.request, allow);
    setNote(resultNote(r));
    // Only a result where nothing went out and a retry may help gives the buttons back.
    if (r.result === "busy" || r.result === "failed" || r.result === "no-identity") setOff(false);
  }
  // The first answer is picked (screens.html `.opt.is-picked`): Enter sends it.
  useKeys((k) => (k === "1" || k === "Enter" ? void press(true) : k === "2" ? void press(false) : undefined));
  return (
    <section aria-label="Approval" className={cardBox}>
      <AgentHead source={card.title || `${card.tool} wants to run`} />
      {card.command && <pre className="whitespace-pre-wrap px-3 pt-0.5 pb-2 font-mono text-[11.5px] leading-[17px] text-muted">{card.command}</pre>}
      <button type="button" disabled={off} aria-keyshortcuts="1 Enter" onClick={() => void press(true)} className={`${optionRow} bg-hover`}>
        <span className={keyMark}>1</span>
        <OptionLabel label="Allow once" />
      </button>
      <button type="button" disabled={off} aria-keyshortcuts="2" onClick={() => void press(false)} className={optionRow}>
        <span className={keyMark}>2</span>
        <OptionLabel label="Deny" />
      </button>
      {note && <CardNote>{note}</CardNote>}
      <div className="flex justify-end pt-1.5"><KeysLine text="1-2 pick  ⏎ send" /></div>
    </section>
  );
}

function Question({ request, question }: { request: string; question: QuestionCard }) {
  const qs = question.questions;
  const [at, setAt] = useState(0);
  // A one-choice question starts with its first answer picked (screens.html `.opt.is-picked`): Enter sends it.
  const [picks, setPicks] = useState<number[][]>(() => qs.map((x) => (x.multi ? [] : [0])));
  const [other, setOther] = useState<string[]>(() => qs.map(() => ""));
  const [note, setNote] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const otherRef = useRef<HTMLInputElement>(null);
  const q = qs[at]!;
  const last = at === qs.length - 1;

  async function send(final = picks) {
    if (off) return;
    setOff(true);
    const r = await window.contr.answer(request, qs.map((_, i) => (other[i] ? { picks: final[i] ?? [], other: other[i] } : { picks: final[i] ?? [] })));
    setNote(resultNote(r));
    if (r.result !== "sent" && r.result !== "unconfirmed") setOff(false);
  }
  // Enter, Next and Send need a pick or own text: an answer with nothing in it does not go out (issue #139).
  const ready = (final = picks) => (final[at]?.length ?? 0) > 0 || !!other[at]?.trim();
  function next(final = picks) {
    if (!ready(final)) return;
    if (last) void send(final);
    else setAt(at + 1);
  }
  function pick(i: number) {
    if (off) return;
    const mine = picks[at] ?? [];
    const updated = picks.map((p, n) => (n !== at ? p : q.multi ? (mine.includes(i) ? mine.filter((x) => x !== i) : [...mine, i].sort()) : [i]));
    setPicks(updated);
    if (!q.multi) next(updated); // A one-choice pick moves on.
  }
  useKeys((k) => {
    const n = Number(k);
    if (n >= 1 && n <= q.options.length) pick(n - 1);
    else if (n === q.options.length + 1 && !question.noOther) otherRef.current?.focus();
    else if (k === "Enter") next();
  });
  const chosen = picks[at] ?? [];
  return (
    <section aria-label="Question" className={cardBox}>
      <AgentHead source={`${q.header}${qs.length > 1 ? ` · ${at + 1} of ${qs.length}` : ""}${q.multi ? " · pick any" : ""}`} />
      <CardText>{q.text}</CardText>
      <div className="mt-1.5 flex flex-col">
        {q.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            disabled={off}
            aria-pressed={chosen.includes(i)}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => pick(i)}
            className={`${optionRow} ${chosen.includes(i) ? "bg-hover" : ""}`}
          >
            {q.multi ? <Check on={chosen.includes(i)} /> : <span className={keyMark}>{i + 1}</span>}
            {/* One choice: the detail is a line under the label (`.opt .d`); pick any: a mono hint after it (`.opt .hint`). */}
            <span className={q.multi ? "" : "flex flex-col"}>
              <OptionLabel label={o.label} recommended={o.recommended} />
              {o.detail && (q.multi ? <span className="ml-2 font-mono text-[11px] text-dim">{o.detail}</span> : <OptionDetail text={o.detail} />)}
            </span>
          </button>
        ))}
      </div>
      {note && <CardNote>{note}</CardNote>}
      <div className="flex items-center gap-3 pt-1.5">
        {question.noOther ? <span className="flex-1" /> : (
          <input
            ref={otherRef}
            aria-label="Own answer"
            aria-keyshortcuts={String(q.options.length + 1)}
            placeholder="Or type an answer"
            disabled={off}
            value={other[at] ?? ""}
            onChange={(e) => {
              setOther(other.map((v, n) => (n === at ? e.target.value : v)));
              // Own text replaces the first answer that was picked for the owner.
              if (!q.multi && e.target.value) setPicks(picks.map((p, n) => (n === at ? [] : p)));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
            className={ownField}
          />
        )}
        <KeysLine text={`${keyRange(q.options.length)} ${q.multi ? "toggle" : "pick"}  ⏎ ${last ? "send" : "next"}`} />
        <button type="button" disabled={off || !ready()} aria-keyshortcuts="Enter" onClick={() => next()} className={primaryButton}>{last ? "Send" : "Next"}</button>
      </div>
    </section>
  );
}

/**
 * Card keys (`isCardKey`): 1-9 and Enter, from anywhere in the window but a text field or a menu.
 * `on` false: the card does not own the keys; it takes none and leaves them to the default action.
 */
export function useKeys(onKey: (key: string) => void, on = true) {
  const ref = useRef(onKey);
  ref.current = onKey;
  useEffect(() => {
    if (!on) return;
    const handler = (event: KeyboardEvent) => {
      if (!isCardKey(event)) return;
      if (/^[1-9]$/.test(event.key) || event.key === "Enter") {
        event.preventDefault();
        ref.current(event.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [on]);
}
