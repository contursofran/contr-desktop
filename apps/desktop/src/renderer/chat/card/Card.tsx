import { useEffect, useRef, useState } from "react";
import type { Card as CardData, PromptResult, QuestionCard } from "../../../shared/api";

/** The note for a `done` result that is not `sent` (docs/reference/helper-protocol.md, `done`). */
export function resultNote(r: PromptResult): string {
  if (r.result === "sent") return "Answer sent. Waiting for the agent.";
  if (r.result === "changed") return "It changed on screen. Here is what it shows now.";
  if (r.result === "unconfirmed") return "Sent. The agent did not confirm it yet.";
  return r.message ?? r.result;
}

/** True when a key press is for the card: not typed into the reply box or another field. */
export function isCardKey(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false;
  return !target?.closest?.("textarea, input, [contenteditable=true]");
}

/** The card above the reply box: answers the agent's approval prompt or question through the helper. */
export function Card({ card }: { card: CardData }) {
  if (card.kind === "question" && card.question.questions.length === 0) return null;
  return card.kind === "approval" ? <Approval key={card.request} card={card} /> : <Question key={card.request} request={card.request} question={card.question} />;
}

const box = "mx-auto mb-2 w-full max-w-3xl rounded-lg border border-border bg-raised p-3 text-sm";
const button = "flex items-center gap-2 rounded-md border border-border px-3 py-1 hover:bg-hover disabled:opacity-50";
const key = "rounded bg-selected px-1.5 font-mono text-xs text-muted";

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
  useKeys((k) => (k === "1" ? void press(true) : k === "2" ? void press(false) : undefined));
  return (
    <section aria-label="Approval" className={box}>
      <p className="font-semibold">{card.title || `${card.tool} wants to run`}</p>
      {card.command && <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-canvas p-2 font-mono text-xs">{card.command}</pre>}
      {note && <p role="status" className="mt-2 text-xs text-muted">{note}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={off} onClick={() => void press(true)} className={button}><span className={key}>1</span>Allow once</button>
        <button type="button" disabled={off} onClick={() => void press(false)} className={button}><span className={key}>2</span>Deny</button>
      </div>
    </section>
  );
}

function Question({ request, question }: { request: string; question: QuestionCard }) {
  const qs = question.questions;
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<number[][]>(() => qs.map(() => []));
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
  function next(final = picks) {
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
    <section aria-label="Question" className={box}>
      <p className="text-xs text-muted">{q.header}{qs.length > 1 ? ` · ${at + 1} of ${qs.length}` : ""}{q.multi ? " · pick any" : ""}</p>
      <p className="mt-1 font-semibold">{q.text}</p>
      <div className="mt-2 flex flex-col gap-1">
        {q.options.map((o, i) => (
          <button key={o.label} type="button" disabled={off} aria-pressed={chosen.includes(i)} onClick={() => pick(i)} className={`${button} text-left ${chosen.includes(i) ? "bg-selected" : ""}`}>
            <span className={key}>{i + 1}</span>
            <span>{o.label}{o.recommended ? <span className="text-muted"> (Recommended)</span> : null}</span>
            {o.detail && <span className="text-xs text-muted">{o.detail}</span>}
          </button>
        ))}
        {!question.noOther && (
          <label className="flex items-center gap-2 px-3 py-1">
            <span className={key}>{q.options.length + 1}</span>
            <input
              ref={otherRef}
              aria-label="Own answer"
              placeholder="Type your own answer"
              disabled={off}
              value={other[at] ?? ""}
              onChange={(e) => setOther(other.map((v, n) => (n === at ? e.target.value : v)))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
              className="flex-1 bg-transparent outline-none placeholder:text-dim"
            />
          </label>
        )}
      </div>
      {note && <p role="status" className="mt-2 text-xs text-muted">{note}</p>}
      <div className="mt-2 flex justify-end">
        <button type="button" disabled={off} onClick={() => next()} className={`${button} bg-foreground text-canvas hover:bg-foreground`}>{last ? "Send" : "Next"}</button>
      </div>
    </section>
  );
}

/** Card keys work while focus is in the chat, not while the owner types in the reply box. */
function useKeys(onKey: (key: string) => void) {
  const ref = useRef(onKey);
  ref.current = onKey;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isCardKey(event)) return;
      if (/^[1-9]$/.test(event.key) || event.key === "Enter") {
        event.preventDefault();
        ref.current(event.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
