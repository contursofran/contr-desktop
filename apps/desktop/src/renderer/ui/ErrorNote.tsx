import type { ReactNode } from "react";

/**
 * An error in the main column, in the card's look (chat/card/Card.tsx): what failed in plain words, the raw error in mono,
 * optional more lines, and Retry. The helper error, the terminal error and "hc is not reachable" use it.
 */
export function ErrorNote({ label, problem, detail, onRetry, children }: { label: string; problem: string; detail: string; onRetry: () => void; children?: ReactNode }) {
  return (
    <section role="alert" aria-label={label} className="mx-auto w-full max-w-read rounded-lg border border-border bg-raised p-3 text-sm">
      <p className="font-semibold">{problem}</p>
      <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-canvas p-2 font-mono text-xs">{detail}</pre>
      {children}
      <button type="button" onClick={onRetry} className="mt-2 flex items-center gap-2 rounded-md border border-border px-3 py-1 hover:bg-hover">
        Retry
      </button>
    </section>
  );
}
