import { Spinner } from "./Spinner";
import type { Working } from "../../../shared/api";

/** The status line above the reply box: spinner, verb, then time and tokens. `right` is the orchestrator text. */
export function StatusLine({ working, right }: { working: Working | null; right?: string }) {
  if (!working?.text && !right) return null;
  return (
    <div aria-label="Status" className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-1 text-xs text-muted">
      {working?.text && (
        <>
          <Spinner className="text-foreground" />
          <span className="text-[13px] text-foreground">{working.text}</span>
          {working.detail && <span className="font-mono text-[11px]">{working.detail.replace(/^\((.*)\)$/, "$1")}</span>}
        </>
      )}
      {right && <span className="ml-auto font-mono text-[11px]">{right}</span>}
    </div>
  );
}
