// Note role adapted from t3code apps/web/src/components/SourceControlAppAccessNotice.tsx
// (b5554ac8114f2ce7ce8b5973690ccb8cbb248efd, MIT). Keep contr’s text and layout.
import { ErrorNote } from "../ui/ErrorNote";

/** The main area with no agent shown: how an agent appears here, or why the list is empty when `hc ls` failed, with Retry (main reads the list again). */
export function Empty({ hcError }: { hcError?: string }) {
  if (hcError)
    return (
      <div className="flex min-h-0 flex-1 items-center px-4">
        <ErrorNote label="hc error" problem="hc is not reachable." detail={hcError} onRetry={() => void window.contr.sidebar()} />
      </div>
    );
  return (
    <div role="note" aria-label="No agent" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-8 text-center">
      <p className="text-[13.5px] text-foreground">No agents yet</p>
      <p className="text-[12.5px] text-muted">An agent that runs in an hc terminal shows here.</p>
    </div>
  );
}
