import type { Board, OwnerQuestion, OwnerTodo, WorkerState } from "../../../shared/api";
import { Tip } from "../../ui/Tip";
import { StatusGlyph } from "../../ui/StatusGlyph";
import { useAllOwnerItems } from "../owner/OwnerCards";
import { OwnerChip } from "../refs/OwnerChip";
import { RefChip } from "../refs/RefChip";
import { useRefState } from "../refs/useRef";
import { WorkerChip } from "../refs/WorkerChip";
import type { StatusLine } from "./parse";
import { STEPS, stepOf, type Step } from "./steps";
import { useBoard } from "./useBoard";

const WORKER_LABEL = { working: "working", done: "done", blocked: "blocked", idle: "idle" } as const;

/** The worker's glyph with its tooltip. */
function Glyph({ state }: { state: WorkerState | undefined }) {
  if (!state) return <span className="w-3.5" />;
  const label = WORKER_LABEL[state];
  return (
    <Tip label={label} side="top">
      <span tabIndex={0} aria-label={label} className="inline-flex w-3.5 justify-center">
        <StatusGlyph state={state} />
      </span>
    </Tip>
  );
}

/** Six marks: full for done steps, ink (pulsing while the worker works) or red for the step now, then the step's word. */
export function StepMarks({ step, working }: { step: Step; working: boolean }) {
  const label = step.word ? `Step: ${step.word}, ${Math.min(step.done, 6)} of 6 done` : "Step not known";
  return (
    <span role="img" aria-label={label} data-step={step.word ?? ""} className="flex items-center gap-[3px]">
      {STEPS.map((name, i) => {
        const tone =
          i === step.current ? (step.you ? "bg-blocked" : working ? "bg-ink-100 motion-safe:animate-pulse" : "bg-ink-100")
          : i < step.done ? "bg-ink-60"
          : "bg-ink-26";
        return <i key={name} data-mark={i === step.current ? "now" : i < step.done ? "done" : "todo"} className={`h-[3px] w-3 rounded-[2px] ${tone}`} />;
      })}
      {step.word && <span className={`ms-1.5 font-mono text-[11px] whitespace-nowrap ${step.you ? "text-blocked" : "text-dim"}`}>{step.word}</span>}
    </span>
  );
}

function WorkerRow({ line, board, item }: { line: StatusLine; board: Board | null; item: OwnerQuestion | OwnerTodo | undefined }) {
  const state = board?.workers[line.worker];
  const pr = board?.checks[line.issue] ?? null;
  const ref = useRefState(pr?.pr ?? line.issue);
  const prState = ref?.kind === "pr" ? ref.state : undefined;
  const step = stepOf({ state, role: board?.roles[line.worker], pr: pr && { state: prState, checks: pr.checks } });
  const tone = step.you ? "text-ink-100" : step.word === "merged" ? "text-dim" : "text-muted";
  return (
    <li data-worker={line.worker} className={`m-0 grid h-8 grid-cols-[14px_40px_minmax(0,1fr)_160px_auto] items-center gap-3 px-1.5 text-[13px] ${tone}`}>
      <Glyph state={state} />
      <span className="truncate font-mono text-[11px] text-dim">{line.worker}</span>
      <span className="truncate">{line.text}</span>
      <StepMarks step={step} working={state === "working"} />
      <span className="flex justify-end">
        {step.you && item ? <OwnerChip item={item} open />
        : pr ? <span data-testid="pr-checks"><RefChip number={pr.pr}>#{pr.pr}</RefChip></span>
        : <RefChip number={line.issue}>#{line.issue}</RefChip>}
      </span>
    </li>
  );
}

/** The one-line form: "Running, no change:" and a chip for each worker; a name the tool does not know shows as text. */
export function RunningLine({ lines, workers }: { lines: StatusLine[]; workers: Record<string, WorkerState> }) {
  return (
    <p data-testid="board-same" className="my-3 flex flex-wrap items-center gap-2 text-[12.5px] text-dim">
      Running, no change:
      {lines.map((l) => {
        const state = workers[l.worker];
        return state ? <WorkerChip key={l.worker} name={l.worker} state={state} /> : <span key={l.worker} className="font-mono text-[11px]">{l.worker}</span>;
      })}
    </p>
  );
}

/**
 * A `contr-status` block as a board (rich-parts.html, Board): each worker's glyph, id, task, step and chip.
 * The state, role and owner item come from the orchestration tool; the PR and its checks from gh.
 * `same` (the fence line `contr-status same`): the agent says nothing changed since its last board, so one line of worker chips shows.
 */
export function StatusBlock({ lines, same = false }: { lines: StatusLine[]; same?: boolean }) {
  const board = useBoard(lines.map((l) => l.issue));
  const items = useAllOwnerItems();
  if (same) return <RunningLine lines={lines} workers={board?.workers ?? {}} />;
  const itemOf = (worker: string) =>
    [...items.questions, ...items.todos].sort((a, b) => a.order - b.order).find((i) => i.coordinator === board?.agent && i.from === worker);
  return (
    <ul aria-label="Workers" className="contr-board my-3 flex list-none flex-col border-y border-hairline py-1" style={{ paddingInlineStart: 0, marginInline: 0 }}>
      {lines.map((line) => <WorkerRow key={`${line.worker}-${line.issue}`} line={line} board={board} item={itemOf(line.worker)} />)}
    </ul>
  );
}
