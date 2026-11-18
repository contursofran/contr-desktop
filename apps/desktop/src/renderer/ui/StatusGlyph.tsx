/** An agent's state as the contr design system shows it: a braille glyph, not a color. */
export type GlyphState = "working" | "waiting" | "idle" | "blocked";

const LABELS: Record<GlyphState, string> = {
  working: "Working",
  waiting: "Waiting",
  idle: "Idle",
  blocked: "Needs you",
};

/** Ink per state. Red (`blocked`) is only for "needs you"; idle is dim. */
const INK: Record<GlyphState, string> = {
  working: "text-ink-100",
  waiting: "text-ink-100",
  idle: "text-ink-30",
  blocked: "text-blocked",
};

/**
 * The status glyph: working ⠋ (turns), waiting ⠿ (pulses), idle ⠶, blocked ⠿ in red (pulses).
 * The glyph and its motion come from CSS (index.css `.status-glyph`), so no timer runs for each row.
 */
export function StatusGlyph({ state, className = "" }: { state: GlyphState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABELS[state]}
      data-state={state}
      className={`status-glyph inline-block w-3.5 shrink-0 text-center font-mono text-[15px] leading-4 ${INK[state]} ${className}`}
    />
  );
}
