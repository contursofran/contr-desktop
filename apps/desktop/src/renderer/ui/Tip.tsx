import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import type { ReactElement, ReactNode } from "react";

/** A UI SDK tooltip in the design's look. `trigger` is the element that shows it on hover and focus. */
export function Tip({ text, trigger, children }: { text: ReactNode; trigger: ReactElement<Record<string, unknown>>; children?: ReactNode }) {
  return (
    <Tooltip delay={400}>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipContent sideOffset={4} className="z-50 m-0 rounded-md border border-border bg-raised px-2 py-1 text-xs text-foreground shadow">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
