import type { ReactNode } from "react";
import { ContextChip, ContextChipLabel } from "./ContextChip";
import { refPresentation } from "./pullRequestIcons";
import { useRefState } from "./useRef";

/** `#12` as a chip with gh's state, or plain text while gh does not know it. Copy gives `#12`. */
export function RefChip({ number, children }: { number: number; children: ReactNode }) {
  const ref = useRefState(number);
  if (!ref) return <>{children}</>;
  const { Icon, label, toneClassName } = refPresentation(ref);
  const kind = ref.kind === "pr" ? "PR" : "Issue";
  return (
    <ContextChip
      href={ref.url}
      className={`${toneClassName} align-baseline`}
      aria-label={`${kind} #${number}, ${label}`}
      data-ref-kind={ref.kind}
      data-ref-state={ref.state}
      onClick={(event) => {
        event.preventDefault();
        void window.contr.openRef(ref.url);
      }}
    >
      <Icon aria-hidden />
      <ContextChipLabel>{children}</ContextChipLabel>
    </ContextChip>
  );
}
