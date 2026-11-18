import { ChipBox, NEUTRAL_OUTLINE } from "./ContextChip";

/** A decision (D112): the id in mono with the neutral outline. The mock has no decision chip, so it stays plain. */
export function DecisionChip({ id }: { id: string }) {
  return (
    <ChipBox className={`${NEUTRAL_OUTLINE} text-ink-100`} aria-label={`Decision ${id}`} data-decision={id}>
      {id}
    </ChipBox>
  );
}
