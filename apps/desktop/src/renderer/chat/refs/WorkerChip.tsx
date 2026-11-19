import { useContext } from "react";
import type { WorkerState } from "../../../shared/api";
import { StatusGlyph } from "../../ui/StatusGlyph";
import { ChipBox, NEUTRAL_OUTLINE } from "./ContextChip";
import { ChipNavigation } from "./navigation";

/**
 * A worker (`b-31`) with its status glyph (rich-parts.html, Chips). The state comes from the
 * orchestration tool (the board's `workers`).
 */
export function WorkerChip({ name, state }: { name: string; state: WorkerState }) {
  const navigation = useContext(ChipNavigation);
  const terminal = navigation?.workers?.find((worker) => worker.name === name)?.terminal;
  const onActivate = navigation && terminal ? () => navigation.select(terminal) : undefined;
  return (
    <ChipBox className={`${NEUTRAL_OUTLINE} text-ink-100`} aria-label={`Worker ${name}, ${state}`} data-worker-state={state} onActivate={onActivate}>
      <StatusGlyph state={state} className="me-[5px] w-auto! text-[11px]! leading-none!" />
      {name}
    </ChipBox>
  );
}
