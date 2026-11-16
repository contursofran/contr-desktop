import { Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { UsageRow } from "../../shared/api";

/**
 * The sidebar foot (docs/design/recipe-herdr.md, the foot): one row per plan (name, meter, "41% wk · 4d"),
 * then Settings and the add machine button. Settings and + do nothing yet (issue 16 builds Settings).
 */
export function Foot() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  useEffect(() => {
    void window.contr.usage().then(setRows);
    return window.contr.onUsage(setRows);
  }, []);
  return (
    <footer className="shrink-0 border-t border-border">
      {rows.length > 0 && (
        <ul aria-label="Plan usage" className="flex flex-col gap-2.5 px-5 pt-3 pb-1.5">
          {rows.map((r) => (
            <li key={r.plan} aria-label={r.plan} className="flex h-4 items-center gap-2">
              <span className="w-[52px] shrink-0 text-xs text-muted">{r.plan}</span>
              <span role="meter" aria-label={`${r.plan} usage`} aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100} className="h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-hover">
                <span className="block h-full bg-dim" style={{ width: `${Math.min(100, r.percent)}%` }} />
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1 px-2.5 pt-1 pb-2.5">
        <button type="button" className="flex h-[30px] flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted hover:bg-hover">
          <Settings aria-hidden className="size-4" />
          Settings
        </button>
        <button type="button" aria-label="Add machine" title="Add machine" className="flex size-7 items-center justify-center self-center rounded-lg text-muted hover:bg-hover">
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </footer>
  );
}
