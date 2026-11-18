/**
 * The note when hc ends the terminal's connection or cannot attach (redesign, screen 5): one centered note over the
 * terminal, not a boxed card. What failed in plain words, hc's reason in mono, and Retry.
 */
export function TerminalNotice({ problem, detail, onRetry }: { problem: string; detail: string; onRetry: () => void }) {
  return (
    // The note covers the terminal: no cursor shows under it.
    <div className="absolute inset-0 flex bg-canvas px-6">
      <section role="alert" aria-label="Terminal error" className="m-auto flex w-full max-w-[520px] flex-col items-start gap-2.5">
        <p className="text-sm text-ink-100">{problem}</p>
        {/* The mock has --ink-45; dim (--ink-50) reaches 4.5:1 in light (decision 198). */}
        <pre className="font-mono text-xs/[18px] whitespace-pre-wrap text-dim">{detail}</pre>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-7 items-center rounded-lg px-3 text-[12.5px] text-ink-90 shadow-[inset_0_0_0_1px_var(--input-line)] hover:bg-hover"
        >
          Retry
        </button>
      </section>
    </div>
  );
}
