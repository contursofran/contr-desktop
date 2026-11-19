/** An agent's state as the contr design system shows it: a braille glyph, not a color. */
export type GlyphState = "working" | "waiting" | "idle" | "blocked" | "done";

export const GLYPH_LABELS: Record<GlyphState, string> = {
  working: "Working",
  waiting: "Waiting",
  idle: "Idle",
  blocked: "Needs you",
  done: "Done",
};

/** Ink per state. Red (`blocked`) is only for "needs you"; idle is dim. */
const INK: Record<GlyphState, string> = {
  working: "text-ink-100",
  waiting: "text-ink-100",
  idle: "text-ink-30",
  blocked: "text-blocked",
  done: "text-ink-42",
};

/**
 * The status glyph: working ⠋ (turns), waiting ⠿ (pulses), idle ⠶, blocked ⠿ in red (pulses), done ⠿ (still).
 * The glyph and its motion come from CSS (index.css `.status-glyph`), so no timer runs for each row.
 * The mock's `.g` is 15 px in a 14 px box; `small` is the tab's glyph (screens.html `.tab .g`): 12 px in a 10 px box.
 */
export function StatusGlyph({ state, small = false, className = "" }: { state: GlyphState; small?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={GLYPH_LABELS[state]}
      data-state={state}
      className={`status-glyph inline-block shrink-0 text-center font-mono leading-4 ${small ? "w-2.5 text-[12px]" : "w-3.5 text-[15px]"} ${INK[state]} ${className}`}
    />
  );
}
