import { CircleQuestionMarkIcon, SquareIcon } from "lucide-react";
import type { OwnerQuestion, OwnerTodo } from "../../../shared/api";
import { ChipBox, NEUTRAL_OUTLINE } from "./ContextChip";

/** Red only means "needs you": the `--blocked` token at 35 % (rich-parts.html, `.chip.is-you`). */
const OPEN_OUTLINE = "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--blocked)_35%,transparent)]";

/**
 * An owner item (D7, T3) from the orchestration tool (`owner open --json`): a question with its title,
 * or a to-do. The outline is red while the item is open, else neutral.
 */
export function OwnerChip({ item, open, showTitle = true }: { item: OwnerQuestion | OwnerTodo; open: boolean; showTitle?: boolean }) {
  const question = "question" in item;
  const Icon = question ? CircleQuestionMarkIcon : SquareIcon;
  const kind = question ? "Question" : "To-do";
  return (
    <ChipBox
      className={`${open ? OPEN_OUTLINE : NEUTRAL_OUTLINE} text-ink-100 [&_svg]:text-ink-62`}
      aria-label={`${kind} ${item.id}${question ? `, ${item.title}` : ""}, ${open ? "open" : "closed"}`}
      data-owner-item={item.id}
      data-open={open}
    >
      <Icon aria-hidden />
      {item.id}
      {showTitle && question && item.title && <span className="ms-[5px] font-sans text-ink-85">{item.title}</span>}
    </ChipBox>
  );
}
