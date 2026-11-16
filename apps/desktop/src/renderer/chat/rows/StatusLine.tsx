import { Spinner } from "./Spinner";
import type { Working } from "../../../shared/api";

/** The status line above the reply box: spinner, verb, then time and tokens. `right` is the orchestrator text.
 * `onOrchestrate`: with no `right` text, a quiet "Orchestrate" at the right that calls it. */
export function StatusLine({
  working,
  right,
  onOrchestrate,
}: {
  working: Working | null;
  right?: string;
  onOrchestrate?: () => void;
}) {
  if (!working?.text && !right && !onOrchestrate) return null;
  return (
    <div aria-label="Status" className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-1 text-xs text-muted">
      {working?.text && (
        <>
          <Spinner size={14} className="text-foreground" />
          <span className="text-[13px] text-foreground">{working.text}</span>
          {working.detail && <span className="font-mono text-[11px]">{working.detail.replace(/^\((.*)\)$/, "$1")}</span>}
        </>
      )}
      {right ? (
        <span className="ml-auto font-mono text-[11px]">{right}</span>
      ) : (
        onOrchestrate && (
          <button type="button" onClick={onOrchestrate} className="ml-auto text-[11px] text-dim hover:text-muted">
            Orchestrate
          </button>
        )
      )}
    </div>
  );
}

/** "Orchestrating · N workers" when the agent has live workers; none gives no text (the status line shows "Orchestrate"). */
export function orchestratingText(n: number): string | undefined {
  if (n <= 0) return undefined;
  return `Orchestrating · ${n} ${n === 1 ? "worker" : "workers"}`;
}

/** The text that the quiet "Orchestrate" puts in the reply box. */
export const ORCHESTRATE_COMMAND = "/contr:orchestrate ";

/** The quiet "Orchestrate" shows for Claude Code with no live workers. */
export function showsOrchestrate(agent: string | undefined, workers: number): boolean {
  return agent === "claude" && workers <= 0;
}
