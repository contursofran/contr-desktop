import { RefChip } from "../refs/RefChip";
import { ChecksMark, StateMark } from "./Marks";
import type { StatusLine } from "./parse";
import { useBoard } from "./useBoard";

const WORKER_LABEL = { working: "working", done: "done", blocked: "blocked", idle: "idle" } as const;

/** A `contr-status` block as a board: each worker's live state, its issue, its work, and its PR's checks. */
export function StatusBlock({ lines }: { lines: StatusLine[] }) {
  const board = useBoard(lines.map((l) => l.issue));
  return (
    <ul aria-label="Workers" className="contr-board my-3 list-none overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-raised)] p-0" style={{ paddingInlineStart: 0, marginInline: 0 }}>
      {lines.map((line) => {
        const state = board?.workers[line.worker];
        const pr = board?.checks[line.issue];
        return (
          <li key={`${line.worker}-${line.issue}`} style={{ marginInline: 0, marginTop: 0 }} className="m-0 flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-2 first:border-t-0">
            {state ? <StateMark state={state} label={WORKER_LABEL[state]} /> : <span className="size-[14px] shrink-0" />}
            <span className="shrink-0 font-mono text-[12px] text-[var(--color-foreground)]">{line.worker}</span>
            <span className="shrink-0"><RefChip number={line.issue}>#{line.issue}</RefChip></span>
            <span className="min-w-0 flex-1 truncate">{line.text}</span>
            {pr && (
              <span className="flex shrink-0 items-center gap-1" data-testid="pr-checks">
                <RefChip number={pr.pr}>#{pr.pr}</RefChip>
                <ChecksMark checks={pr.checks} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
