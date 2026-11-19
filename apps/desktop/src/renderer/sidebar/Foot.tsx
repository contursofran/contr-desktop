import { Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeUsage, type UsageSnapshot } from "../state/usage";
import { Tip } from "../ui/Tip";
import { usageTip } from "./usageTip";

/**
 * The sidebar foot (docs/design/recipe-herdr.md, the foot): one row per plan (name, meter, "41% wk · 4d"; a stale
 * plan: an empty meter and "—"), with a tooltip that says when the data was read,
 * then Settings and the add machine button. Settings opens the Settings view and has a dot (`accent`) when an update of the app or the core is ready; + does nothing yet.
 */
export function Foot({ onSettings, settingsShown }: { onSettings: () => void; settingsShown: boolean }) {
  const [{ rows, now }, setUsage] = useState<UsageSnapshot>(() => ({ rows: [], now: Date.now() }));
  const [appReady, setAppReady] = useState(false);
  const [coreReady, setCoreReady] = useState(false);
  useEffect(() => {
    void window.contr.update().then((u) => setAppReady(u.available));
    return window.contr.onUpdate((u) => setAppReady(u.available));
  }, []);
  useEffect(() => {
    void window.contr.core().then((c) => setCoreReady(c.available));
    return window.contr.onCore((c) => setCoreReady(c.available));
  }, []);
  const ready = appReady || coreReady;
  useEffect(() => subscribeUsage(window.contr, setUsage), []);
  // "Read 2h ago" draws again each 30 s, as the sidebar's ages do.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setUsage((usage) => ({ ...usage, now }));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <footer className="shrink-0 border-t border-hairline">
      {rows.length > 0 && (
        <ul aria-label="Plan usage" className="flex flex-col gap-[9px] px-[18px] pt-3 pb-1.5">
          {rows.map((r) => {
            const row = (
              <li key={r.plan} aria-label={r.plan} className="flex h-4 items-center gap-3">
                <span className="w-11 shrink-0 text-xs text-dim">{r.plan}</span>
                <span role="meter" aria-label={`${r.plan} usage`} aria-valuenow={r.percent ?? undefined} aria-valuetext={r.percent === null ? "No current data" : undefined} aria-valuemin={0} aria-valuemax={100} className="h-1 min-w-0 flex-1 overflow-hidden rounded-sm bg-meter-track">
                  <span className="block h-full bg-meter-fill" style={{ width: `${Math.min(100, r.percent ?? 0)}%` }} />
                </span>
                <span className="w-[88px] shrink-0 text-right font-mono text-[11px] whitespace-nowrap text-muted tabular-nums">{r.value}</span>
              </li>
            );
            const tip = usageTip(r, now);
            return tip === null ? row : <Tip key={r.plan} label={tip} side="top">{row}</Tip>;
          })}
        </ul>
      )}
      <div className="flex gap-1 px-2 pt-1 pb-2">
        <button type="button" aria-pressed={settingsShown} onClick={onSettings} className={`flex h-[30px] flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-hover ${settingsShown ? "bg-selected text-ink-100 shadow-[var(--shadow-selected)]" : "text-muted"}`}>
          <Settings aria-hidden strokeWidth={1.6} className="size-[15px]" />
          Settings
          {ready && <span aria-label="Update ready" className="ml-auto size-1.5 rounded-full bg-working" />}
        </button>
        {/* Add machine does nothing yet: inert as the top bar's +. */}
        <Tip label="Add machine (not yet)" side="top">
          <button type="button" aria-label="Add machine" aria-disabled="true" className="flex size-[26px] items-center justify-center self-center rounded-lg text-faint">
            <Plus aria-hidden strokeWidth={1.6} className="size-3.5" />
          </button>
        </Tip>
      </div>
    </footer>
  );
}
