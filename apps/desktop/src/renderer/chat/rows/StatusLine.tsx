import type { Working } from "../../../shared/api";

/** The status line above the reply box: spinner, verb, then time and tokens. `right` is the orchestrator text. */
export function StatusLine({ working, right }: { working: Working | null; right?: string }) {
  if (!working?.text && !right) return null;
  return (
    <div aria-label="Status" className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-1 text-xs text-muted">
      {working?.text && (
        <>
          <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-working border-t-transparent" />
          <span className="text-foreground">{working.text}</span>
          {working.detail && <span>{working.detail}</span>}
        </>
      )}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}
