import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip";
import type { ReactElement } from "react";

/** A UI SDK tooltip on `children` (one element) with the text `label`. */
export function Tip({ label, children, side = "bottom" }: { label: string; children: ReactElement<Record<string, unknown>>; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip delay={500}>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} sideOffset={4} className="m-0 max-w-[320px] rounded-md border border-border bg-raised px-2 py-1 text-xs text-foreground shadow">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
