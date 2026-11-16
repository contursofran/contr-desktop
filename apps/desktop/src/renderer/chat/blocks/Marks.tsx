import { Check } from "lucide-react";
import type { PrChecks, WorkerState } from "../../../shared/api";
import { Spinner } from "../rows/Spinner";
import { Tip } from "../../ui/Tip";

/** The design's status marks: loader (working), check (done), dot (blocked), empty ring (idle). */
export function StateMark({ state, label }: { state: WorkerState; label: string }) {
  const box = "inline-flex size-[14px] shrink-0 items-center justify-center";
  const icon =
    state === "working" ? <Spinner className="text-[13px] leading-none text-[var(--color-working)]" />
    : state === "done" ? <Check className="size-[13px] text-[var(--color-done)]" />
    : state === "blocked" ? <span className="size-[9px] rounded-full bg-[var(--color-blocked)]" />
    : <span className="size-[12px] rounded-full border border-[var(--color-dim)]" />;
  return <Tip text={label} trigger={<span className={box} tabIndex={0} aria-label={label} data-state={state} />}>{icon}</Tip>;
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
