import type { PrChecks, RefState, WorkerState } from "../../../shared/api";

/** The six steps of a worker (rich-parts.html, Board). */
export const STEPS = ["plan", "build", "PR", "CI", "review", "merge"] as const;

/** What the sources prove about one worker: the tool's state and role, and gh's PR. */
export interface StepInput {
  state?: WorkerState;
  /** The tool's `role`, such as `builder-medium`. */
  role?: string;
  pr?: { state?: Extract<RefState, { kind: "pr" }>["state"]; checks: PrChecks["checks"] } | null;
}

/**
 * `done` marks are full; the mark at `current` is the step now (red when `you`). `word` names it.
 * No current mark and no word: the sources prove no step.
 */
export interface Step {
  done: number;
  current: number | null;
  word: string | null;
  you: boolean;
}

function fromSources({ role = "", pr }: StepInput): Omit<Step, "you"> {
  if (pr?.state === "merged") return { done: 6, current: null, word: "merged" };
  if (pr?.state === "closed") return { done: 2, current: null, word: "closed" };
  if (role.startsWith("reviewer")) return { done: 4, current: 4, word: "review" };
  if (pr) {
    if (pr.checks === "pending") return { done: 3, current: 3, word: "CI" };
    if (pr.checks === "fail") return { done: 3, current: 3, word: "CI fails" };
    if (pr.checks === "pass") return { done: 4, current: null, word: "CI passed" };
    return { done: 2, current: 2, word: "PR" };
  }
  if (role.startsWith("planner")) return { done: 0, current: 0, word: "plan" };
  if (role.startsWith("builder")) return { done: 1, current: 1, word: "build" };
  return { done: 0, current: null, word: null };
}

/** The step of a worker from the orchestration tool (state, role) and gh (PR, checks). A blocked worker asks the owner. */
export function stepOf(input: StepInput): Step {
  const step = fromSources(input);
  if (input.state !== "blocked" || step.done >= 6) return { ...step, you: false };
  return { done: step.done, current: step.current ?? step.done, word: "asks you", you: true };
}
