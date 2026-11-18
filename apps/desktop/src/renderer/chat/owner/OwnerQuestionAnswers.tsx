import { useRef, useState, type ReactNode } from "react";
import type { OwnerQuestion, OwnerResult } from "../../../shared/api";
import { keyRange, KeysLine, ownField, primaryButton, RadioAnswers, useKeys } from "../card/Card";

export function useOwnerRun(onSaved: (note: string) => void) {
  const [off, setOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async (call: () => Promise<OwnerResult>) => {
    if (off) return;
    setOff(true);
    const result = await call();
    if (!result.ok) {
      setError(result.note);
      setOff(false);
    } else if (result.note) onSaved(result.note);
  };
  return { off, error, go };
}

export function OwnerQuestionAnswers({ q, onSaved, keys = true, errorColor, children }: {
  q: OwnerQuestion;
  onSaved: (note: string) => void;
  keys?: boolean;
  errorColor: string;
  children: ReactNode;
}) {
  const { off, error, go } = useOwnerRun(onSaved);
  const [other, setOther] = useState("");
  const [selection, setSelection] = useState<number | null>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const fallback = Math.max(0, q.options.findIndex((option) => option.recommended));
  const picked = other.trim() || !q.options.length ? null : selection ?? fallback;
  const answer = picked === null ? other.trim() : q.options[picked]?.label ?? "";
  function send(value: string) {
    const text = value.trim();
    if (text) void go(() => window.contr.ownerAnswer(q.id, text));
  }
  const pick = (i: number) => send(q.options[i]?.label ?? "");
  useKeys((key) => {
    const digit = Number(key);
    if (digit >= 1 && digit <= q.options.length) pick(digit - 1);
    else if (digit === q.options.length + 1) otherRef.current?.focus();
    else if (key === "Enter") send(answer);
  }, keys);
  return (
    <form className="contents" onSubmit={(e) => { e.preventDefault(); send(answer); }}>
      <RadioAnswers label={q.question} options={q.options.map((option) => ({ ...option, detail: option.impact }))}
        picked={picked} disabled={off} keys={keys} onSelect={(i) => { setOther(""); setSelection(i); }} onPick={pick} />
      {children}
      {error && <p role="alert" className={`px-3 pt-1 text-xs ${errorColor}`}>{error}</p>}
      <div className="flex items-center gap-3 pt-1.5">
        <input
          ref={otherRef}
          aria-label="Own answer"
          aria-keyshortcuts={keys && q.options.length < 9 ? String(q.options.length + 1) : undefined}
          placeholder="Or type an answer"
          disabled={off}
          value={other}
          onChange={(e) => { setOther(e.target.value); setSelection(null); }}
          className={ownField}
        />
        {keys && <KeysLine text={`${keyRange(q.options.length)} pick  ⏎ send`} />}
        <button type="submit" disabled={off || !answer} className={primaryButton}>Send answer</button>
      </div>
    </form>
  );
}
