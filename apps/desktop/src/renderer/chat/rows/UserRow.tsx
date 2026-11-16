import { useState } from "react";
import type { FeedRow } from "../../../shared/api";

/** The owner's message: a right-aligned bubble. A note from another agent (`from`) is one line that opens. */
export function UserRow({ row }: { row: FeedRow }) {
  const [open, setOpen] = useState(false);
  const text = row.text ?? "";
  if (row.from) {
    const first = text.split("\n")[0];
    return (
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full text-left text-sm text-muted hover:text-foreground">
        ↳ {row.from}: {open ? <span className="whitespace-pre-wrap">{text}</span> : first}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-raised px-4 py-2 text-sm">{text}</p>
      {row.images ? <span className="text-xs text-dim">{row.images === 1 ? "1 picture" : `${row.images} pictures`}</span> : null}
    </div>
  );
}
