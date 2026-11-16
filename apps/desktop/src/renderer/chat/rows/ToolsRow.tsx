import { useState } from "react";
import { CheckIcon, ChevronDownIcon, FileTextIcon, PencilIcon, SearchIcon, SquareTerminalIcon, WrenchIcon, type LucideIcon } from "lucide-react";
import type { FeedRow } from "../../../shared/api";
import { Spinner } from "./Spinner";

type Chip = NonNullable<FeedRow["chips"]>[number];

/** SF Symbol names from the helper, mapped to lucide icons. Other names show a wrench. */
const ICONS: Record<string, LucideIcon> = {
  terminal: SquareTerminalIcon,
  "doc.text": FileTextIcon,
  doc: FileTextIcon,
  magnifyingglass: SearchIcon,
  pencil: PencilIcon,
};

export function chipIcon(symbol: string): LucideIcon {
  return ICONS[symbol] ?? WrenchIcon;
}

/** Tool calls folded into round chips, side by side. A click opens a chip to its calls. */
export function ToolsRow({ row }: { row: FeedRow }) {
  const [open, setOpen] = useState<number | null>(null);
  const chips = row.chips ?? [];
  const shown = open === null ? undefined : chips[open];
  return (
    <div className="text-sm">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, i) => <ToolChip key={i} chip={chip} open={open === i} onClick={() => setOpen(open === i ? null : i)} />)}
      </div>
      {shown && (
        <ul aria-label={`${shown.text} calls`} className="mt-1.5 ml-2 border-l border-border pl-3">
          {shown.calls.map((call, i) => (
            <li key={i} className="py-0.5">
              <span className="text-dim">{call.name}</span> <span className="font-mono text-xs">{call.summary}</span>{" "}
              {!call.done ? <Spinner size={11} className="text-working" /> : call.error ? <span className="text-blocked">failed</span> : <CheckIcon aria-label="done" className="inline size-3 text-done" />}
              {call.output && <pre className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-dim">{call.output}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolChip({ chip, open, onClick }: { chip: Chip; open: boolean; onClick: () => void }) {
  const Icon = chipIcon(chip.symbol);
  const running = chip.calls.some((c) => !c.done);
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-chrome px-3 text-muted hover:text-foreground">
      {running ? <Spinner size={11} className="text-working" /> : <Icon aria-hidden className="size-3.5" />}
      <span>{chip.text}</span>
      <ChevronDownIcon aria-hidden className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}
