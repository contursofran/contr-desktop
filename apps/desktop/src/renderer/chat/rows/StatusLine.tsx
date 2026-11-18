import { StatusGlyph } from "../../ui/StatusGlyph";
import type { Working } from "../../../shared/api";

/** The status line above the reply box (docs/design/redesign/screens.html, screen 1): the working glyph, the verb, then
 * time and tokens in 11 px mono. The mono uses ink-38 in dark and dim in light (decision 198).
 * The 12 px text uses dim. The glyph keeps the label "running" for screen readers.
 * In a narrow line the verb stays whole and the detail truncates with an ellipsis.
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
    <div aria-label="Status" className="mx-auto flex w-full max-w-read items-center gap-2.5 px-1 pt-1 pb-2 text-xs leading-[18px] text-dim">
      {working?.text && (
        <>
          <span role="status" aria-label="running" className="flex shrink-0 text-ink-100">
            <StatusGlyph state="working" className="text-[13px]!" />
          </span>
          <span className="shrink-0 whitespace-nowrap">{working.text}</span>
          {working.detail && <span className="min-w-0 shrink truncate font-mono text-[11px] text-dim dark:text-ink-38">{working.detail.replace(/^\((.*)\)$/, "$1")}</span>}
        </>
      )}
      {right ? (
        <span className="ml-auto min-w-0 shrink-0 truncate">{right}</span>
      ) : (
        onOrchestrate && (
          <button type="button" onClick={onOrchestrate} className="ml-auto shrink-0 text-[11px] text-dim hover:text-muted">
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
