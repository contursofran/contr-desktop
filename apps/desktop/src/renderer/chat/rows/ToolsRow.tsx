import { useState } from "react";
import type { FeedRow } from "../../../shared/api";

type Chip = NonNullable<FeedRow["chips"]>[number];

/** Tool calls folded into chips ("Ran 2 commands"). A chevron opens a chip to its calls. */
export function ToolsRow({ row }: { row: FeedRow }) {
  return (
    <div className="flex flex-col gap-1">
      {(row.chips ?? []).map((chip, i) => <ToolChip key={i} chip={chip} />)}
    </div>
  );
}

function ToolChip({ chip }: { chip: Chip }) {
  const [open, setOpen] = useState(false);
  const running = chip.calls.some((c) => !c.done);
  return (
    <div className="text-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1 text-muted hover:text-foreground">
        <span>{chip.text}</span>
        <span aria-hidden className={`inline-block text-xs transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        {running && <span aria-label="running" className="ml-1 size-2 animate-pulse rounded-full bg-working" />}
      </button>
      {open && (
        <ul className="mt-1 ml-2 border-l border-border pl-3">
          {chip.calls.map((call, i) => (
            <li key={i} className="py-0.5">
              <span className={call.error ? "text-blocked" : "text-dim"}>{call.name}</span> <span className="font-mono text-xs">{call.summary}</span>
              {call.output && <pre className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-dim">{call.output}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
