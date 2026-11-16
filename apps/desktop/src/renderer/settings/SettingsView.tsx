import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useEffect, useState } from "react";
import type { Settings, ThemeChoice, UpdateState } from "../../shared/api";

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** The Settings view in the main pane: the theme choice, the updates and the helper path. All colors from the theme tokens. */
export function SettingsView() {
  const [data, setData] = useState<Settings>();
  useEffect(() => {
    void window.contr.settings().then(setData);
  }, []);
  const choose = (theme: ThemeChoice) => {
    void window.contr.setTheme(theme).then((t) => setData((d) => d && { ...d, theme: t }));
  };
  return (
    <section aria-label="Settings" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted">Appearance</h2>
          <div className="flex items-center justify-between rounded-xl border border-border bg-raised px-4 py-3">
            <span className="text-[13px]">Theme</span>
            <SegmentedControl<ThemeChoice>
              aria-label="Theme"
              value={data?.theme ?? null}
              onValueChange={(v) => v && choose(v)}
              className="relative isolate flex gap-1 rounded-lg bg-canvas p-0.5"
            >
              <SegmentedControlIndicator className="absolute -z-10 top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-md bg-selected" />
              {THEMES.map((t) => (
                <SegmentedControlItem
                  key={t.value}
                  value={t.value}
                  className="relative rounded-md px-3 py-1 text-xs text-muted outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-foreground data-checked:text-foreground data-checked:hover:bg-transparent"
                >
                  {t.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        </div>
        <Updates />
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted">Helper</h2>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-raised px-4 py-3">
            <span className="text-[13px]">Path</span>
            <span aria-label="Helper path" className="min-w-0 truncate font-mono text-[11px] text-muted">{data?.helper}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The Updates section: this version, the newest one, and the Update button (installs the .zip, else opens the .dmg). */
function Updates() {
  const [u, setU] = useState<UpdateState>();
  useEffect(() => {
    void window.contr.update().then(setU);
    return window.contr.onUpdate(setU);
  }, []);
  const newest = u?.dev ? "Development build" : (u?.latest ?? "Checking…");
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted">Updates</h2>
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-raised px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Version</span>
          <span aria-label="Current version" className="font-mono text-[11px] text-muted">{u?.current}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Newest</span>
          <span className="flex items-center gap-3">
            <span aria-label="Newest version" className="font-mono text-[11px] text-muted">{newest}</span>
            {u?.ready ? (
              <button type="button" onClick={() => void window.contr.restartToUpdate()} className="rounded-md bg-working px-3 py-1 text-xs text-white">
                Restart to update
              </button>
            ) : u?.available && (
              <button type="button" disabled={u.progress !== null} onClick={() => void window.contr.downloadUpdate()} className="rounded-md bg-working px-3 py-1 text-xs text-white disabled:opacity-60">
                {u.progress !== null ? `Downloading ${u.progress}%` : "Update"}
              </button>
            )}
          </span>
        </div>
        {u?.progress != null && <progress aria-label="Download" max={100} value={u.progress} className="h-1 w-full" />}
        {u?.downloaded && <span role="status" className="text-xs text-muted">Opened {u.downloaded}. Drag contr to Applications.</span>}
        {u?.error && <span role="alert" className="text-xs text-blocked">{u.error}</span>}
      </div>
    </div>
  );
}
