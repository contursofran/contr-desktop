import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { useState } from "react";
import type { FeedRow } from "../../../shared/api";
import { oneLine } from "./oneLine";
import { Spinner } from "./Spinner";

type Chip = NonNullable<FeedRow["chips"]>[number];

/**
 * The helper's chip labels as one line: "Read 6 files, ran 3 commands" (redesign #184).
 * The first label keeps its capital; the next ones start in lower case.
 */
export function foldText(chips: Chip[]): string {
  return chips
    .map((chip, i) => (i === 0 ? chip.text : chip.text.charAt(0).toLowerCase() + chip.text.slice(1)))
    .join(", ");
}

/** An answer's tool calls folded into one quiet line. A click opens one line per call with its result. */
export function ToolsRow({ row }: { row: FeedRow }) {
  const [open, setOpen] = useState(false);
  const chips = row.chips ?? [];
  const calls = chips.flatMap((chip) => chip.calls);
  const running = calls.some((c) => !c.done);
  const text = foldText(chips);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="flex max-w-full items-center gap-2 text-[12.5px] text-dim hover:text-muted"
      >
        <span aria-hidden className={`inline-block w-[9px] shrink-0 text-[9px] text-faint transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {running && <Spinner size={11} className="text-working" />}
        <span className="truncate">{text}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <ul aria-label={`${text} calls`} className="flex flex-col gap-0.5 pl-[17px] font-mono text-[11.5px] leading-5 text-dim">
          {calls.map((call, i) => (
            <li key={i} className="flex min-w-0 items-center gap-2" title={call.name}>
              <span className="min-w-0 truncate text-ink-85">{call.summary || call.name}</span>
              {!call.done ? (
                <Spinner size={11} className="text-working" />
              ) : call.error ? (
                <span role="img" aria-label="failed" className="shrink-0 text-ink-100">✕</span>
              ) : null}
              {call.output && <span className="min-w-0 truncate">{oneLine(call.output)}</span>}
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
