import { useEffect, useState } from "react";
import type { ChangeLog as Log } from "../../shared/api";
import { markOf, OPEN_COUNT } from "./marks";

const button = "rounded-md border border-border px-3 py-1 text-xs hover:bg-hover disabled:opacity-50";

/**
 * Settings > Change log, under Updates: the newest releases, newest first, each with its version, date and the
 * lines of its notes' "## Changes" part. The main process reads them with each update check, so this asks again
 * when `checked` changes. A "(#123)" stays plain text. With nothing to read (dev, e2e with no fake URL) it shows nothing.
 */
export function ChangeLog({ current, checked }: { current: string | undefined; checked: number | null | undefined }) {
  const [log, setLog] = useState<Log>();
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const load = (again: boolean) => {
    setLoading(true);
    void window.contr.changeLog(again).then((l) => {
      setLog(l);
      setLoading(false);
    });
  };
  useEffect(() => load(false), [checked]);
  if (!loading && log?.releases == null && !log?.error) return null;
  const releases = log?.releases ?? [];
  const shown = older ? releases : releases.slice(0, OPEN_COUNT);
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted">Change log</h2>
      <div role="region" aria-label="Change log" className="flex flex-col gap-3 rounded-xl border border-border bg-raised px-4 py-3">
        {loading && !log?.releases && <span role="status" className="text-xs text-muted">Loading the change log…</span>}
        {!loading && log?.error && (
          <div className="flex items-center justify-between gap-4">
            <span role="alert" className="text-xs text-error">{log.error}</span>
            <button type="button" onClick={() => load(true)} className={button}>Retry</button>
          </div>
        )}
        {shown.length > 0 && (
          <ol className="flex flex-col gap-3">
            {shown.map((r) => {
              const mark = markOf(r.version, current);
              return (
                <li key={r.tag || r.version} aria-label={`contr ${r.version}`} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[13px]">{r.version}</span>
                      {mark && (
                        <span aria-label="Mark" className="flex items-center gap-1.5 text-xs text-muted">
                          {mark === "New" && <span className="size-1.5 rounded-full bg-working" />}
                          {mark}
                        </span>
                      )}
                    </span>
                    <span aria-label="Date" className="font-mono text-[11px] text-muted">{r.date}</span>
                  </div>
                  {r.changes.length > 0 && (
                    <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs marker:text-muted">
                      {r.changes.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {!older && releases.length > OPEN_COUNT && (
          <button type="button" onClick={() => setOlder(true)} className={`self-start ${button}`}>Show older</button>
        )}
      </div>
    </div>
  );
}
