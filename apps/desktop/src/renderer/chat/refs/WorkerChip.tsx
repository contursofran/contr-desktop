import type { WorkerState } from "../../../shared/api";
import { StatusGlyph } from "../../ui/StatusGlyph";
import { ChipBox, NEUTRAL_OUTLINE } from "./ContextChip";

/**
 * A worker (`b-31`) with its status glyph (rich-parts.html, Chips). The state comes from the
 * orchestration tool (the board's `workers`).
 */
export function WorkerChip({ name, state }: { name: string; state: WorkerState }) {
  return (
    <ChipBox className={`${NEUTRAL_OUTLINE} text-ink-100`} aria-label={`Worker ${name}, ${state}`} data-worker-state={state}>
      <StatusGlyph state={state} className="me-[5px] w-auto! text-[11px]! leading-none!" />
      {name}
    </ChipBox>
  );
}
