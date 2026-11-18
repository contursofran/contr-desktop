import type { ReactNode } from "react";
import { checksLabel, ChecksMark } from "./ChecksMark";
import { ContextChip, ContextChipLabel } from "./ContextChip";
import { refPresentation } from "./pullRequestIcons";
import { useRefState } from "./useRef";

/** The state color (`--st`) on the icon and, at 38 %, on the outline (rich-parts.html, Chips). */
const STATE_CLASS =
  "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--st)_38%,transparent)] [&_svg]:text-(--st)";

/** `#12` as a chip with gh's state, or plain text while gh does not know it. Copy gives `#12`. */
export function RefChip({ number, children }: { number: number; children: ReactNode }) {
  const ref = useRefState(number);
  if (!ref) return <>{children}</>;
  const { Icon, label, toneClassName, dim } = refPresentation(ref);
  const kind = ref.kind === "pr" ? "PR" : "Issue";
  const checks = ref.kind === "pr" ? ref.checks : undefined;
  return (
    <ContextChip
      href={ref.url}
      className={`${toneClassName} ${STATE_CLASS} ${dim ? "text-dim" : "text-ink-100"} align-baseline`}
      aria-label={`${kind} #${number}, ${label}${checks ? `, ${checksLabel(checks)}` : ""}`}
      data-ref-kind={ref.kind}
      data-ref-state={ref.state}
      onClick={(event) => {
        event.preventDefault();
        void window.contr.openRef(ref.url);
      }}
    >
      <Icon aria-hidden />
      <ContextChipLabel>{children}</ContextChipLabel>
      {checks && <ChecksMark checks={checks} />}
    </ContextChip>
  );
}
