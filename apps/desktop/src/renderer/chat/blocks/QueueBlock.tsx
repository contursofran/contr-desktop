import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { RefState } from "../../../shared/api";
import { RefChip } from "../refs/RefChip";
import { useRefState } from "../refs/useRef";
import type { QueueStep } from "./parse";

/** A step is done when gh says its PR merged or its issue closed; the first step not done is now. */
type Step = "done" | "now" | "next";
const isDone = (ref: RefState | null | undefined) => ref?.state === "merged" || (ref?.kind === "issue" && ref.state === "closed");

/** The dot on the rail (rich-parts.html, Merge queue): filled when done, a bright ring now, a dim ring next. */
const DOT: Record<Step, string> = {
  done: "bg-ink-62",
  now: "shadow-[inset_0_0_0_1.5px_var(--ink-100)]",
  next: "shadow-[inset_0_0_0_1.5px_var(--ink-50)]",
};

/** A note with each `#12` as a chip, as the chat shows `#12` in text. */
function Note({ text }: { text: string }): ReactNode {
  return text.split(/(#\d+)/).map((part, i) =>
    i % 2 ? <RefChip key={i} number={Number(part.slice(1))}>{part}</RefChip> : part,
  );
}

function Row({ step, index, state, report }: { step: QueueStep; index: number; state: Step; report: (i: number, done: boolean) => void }) {
  const done = isDone(useRefState(step.number));
  useEffect(() => report(index, done), [report, index, done]);
  return (
    <li data-step={state} style={{ marginInline: 0, marginTop: 0 }} className="relative m-0 grid grid-cols-[16px_1fr_auto] items-start gap-3 pb-3 before:absolute before:top-[18px] before:bottom-0 before:left-[7.5px] before:border-l before:border-ink-26 last:pb-0 last:before:hidden">
      <span aria-hidden className={`mt-1.5 ml-[3px] size-[9px] rounded-full ${DOT[state]}`} />
      <div className="min-w-0">
        <div className="truncate"><RefChip number={step.number}>#{step.number}</RefChip> {step.label}</div>
        {step.note && <div className="text-[12px] text-dim"><Note text={step.note} /></div>}
      </div>
      <span className="pt-0.5 font-mono text-[11px] text-dim">{index + 1}</span>
    </li>
  );
}

/** A `contr-queue` block as a rail: done, now, next; each step with its PR or issue, its label, and what it waits for. */
export function QueueBlock({ steps }: { steps: QueueStep[] }) {
  // Each row reads gh's state of its step; the list needs them all to know which step is now.
  const [done, setDone] = useState<Record<number, boolean>>({});
  const report = useCallback((i: number, d: boolean) => setDone((p) => (p[i] === d ? p : { ...p, [i]: d })), []);
  return (
    <ol aria-label="Merge order" className="contr-queue my-3 flex list-none flex-col p-0" style={{ paddingInlineStart: 6, marginInline: 0 }}>
      {steps.map((step, i) => {
        const state: Step = done[i] ? "done" : steps.slice(0, i).every((_, j) => done[j]) ? "now" : "next";
        return <Row key={`${i}-${step.number}`} step={step} index={i} state={state} report={report} />;
      })}
    </ol>
  );
}
