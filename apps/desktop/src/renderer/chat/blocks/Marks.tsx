import { Check } from "lucide-react";
import type { PrChecks, WorkerState } from "../../../shared/api";
import { Spinner } from "../rows/Spinner";

/** The design's status marks: loader (working), check (done), dot (blocked), empty ring (idle). */
export function StateMark({ state, label }: { state: WorkerState; label: string }) {
  const box = "inline-flex size-[14px] shrink-0 items-center justify-center";
  if (state === "working") return <span className={box} title={label} data-state={state}><Spinner className="text-[13px] leading-none text-[var(--color-working)]" /></span>;
  if (state === "done") return <span className={box} title={label} aria-label={label} data-state={state}><Check className="size-[13px] text-[var(--color-done)]" /></span>;
  if (state === "blocked") return <span className={box} title={label} aria-label={label} data-state={state}><span className="size-[9px] rounded-full bg-[var(--color-blocked)]" /></span>;
  return <span className={box} title={label} aria-label={label} data-state={state}><span className="size-[12px] rounded-full border border-[var(--color-dim)]" /></span>;
}

const CHECKS: Record<NonNullable<PrChecks["checks"]>, { state: WorkerState; label: string }> = {
  pass: { state: "done", label: "checks pass" },
  pending: { state: "working", label: "checks running" },
  fail: { state: "blocked", label: "checks fail" },
};

/** A PR's checks as a status mark; nothing when the PR has no checks. */
export function ChecksMark({ checks }: { checks: PrChecks["checks"] }) {
  if (!checks) return null;
  const { state, label } = CHECKS[checks];
  return <StateMark state={state} label={label} />;
}
