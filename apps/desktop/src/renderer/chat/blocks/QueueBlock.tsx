import { RefChip } from "../refs/RefChip";
import type { QueueStep } from "./parse";

/** A `contr-queue` block as an ordered queue: step number, the PR or issue, its label, and the dependency note. */
export function QueueBlock({ steps }: { steps: QueueStep[] }) {
  return (
    <ol aria-label="Merge order" className="contr-queue my-3 list-none overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-raised)] p-0" style={{ paddingInlineStart: 0, marginInline: 0 }}>
      {steps.map((step, i) => (
        <li key={`${i}-${step.number}`} style={{ marginInline: 0, marginTop: 0 }} className="m-0 flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2 first:border-t-0">
          <span className="w-[2ch] shrink-0 text-right font-mono text-[12px] text-[var(--color-dim)]">{i + 1}</span>
          <span className="shrink-0"><RefChip number={step.number}>#{step.number}</RefChip></span>
          <span className="min-w-0 flex-1 truncate">{step.label}</span>
          {step.note && <span className="shrink-0 font-mono text-[11px] text-[var(--color-muted)]">{step.note}</span>}
        </li>
      ))}
    </ol>
  );
}
