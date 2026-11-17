/** The main area with no agent shown: how an agent appears here, and why the list is empty when `hc ls` failed. */
export function Empty({ hcError }: { hcError?: string }) {
  return (
    <div role="status" aria-label="No agent" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-8 text-center">
      {hcError ? (
        <>
          <p className="text-[13.5px] text-foreground">hc is not reachable.</p>
          <p className="max-w-xl truncate font-mono text-[11.5px] text-muted">{hcError}</p>
        </>
      ) : (
        <>
          <p className="text-[13.5px] text-foreground">No agents yet</p>
          <p className="text-[12.5px] text-muted">An agent that runs in an hc terminal shows here.</p>
        </>
      )}
    </div>
  );
}
