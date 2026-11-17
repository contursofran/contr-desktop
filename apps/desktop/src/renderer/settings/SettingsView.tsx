import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useEffect, useState, type ReactNode } from "react";
import type { CoreState, Settings, ThemeChoice, UpdateState } from "../../shared/api";
import { PathText } from "../ui/PathText";
import { ChangeLog } from "./ChangeLog";
import { updateView, type UpdateView } from "./updateView";

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** The Settings view in the main pane: the theme choice, the updates, the core, the change log, and the helper path. All colors from the theme tokens. */
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
              className="relative isolate flex gap-1 rounded-lg border border-border bg-chrome p-0.5"
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
            <PathText label="Helper path" path={data?.helper ?? ""} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The Updates section: this version, the newest one, Check now, and the Update button (installs the .zip, else opens the .dmg).
 * Each open of the view runs one check. The change log stands under it, after the Core part.
 */
function Updates() {
  const [u, setU] = useState<UpdateState>();
  useEffect(() => {
    void window.contr.update().then(setU);
    void window.contr.checkUpdate();
    return window.contr.onUpdate(setU);
  }, []);
  const now = useNow();
  return (
    <>
      <UpdateCard
        title="Updates"
        view={updateView(u, now)}
        current={u?.current}
        labels={{ current: "Current version", newest: "Newest version", lastCheck: "Last check" }}
        onCheck={() => void window.contr.checkUpdate()}
        onUpdate={() => void window.contr.downloadUpdate()}
        onRestart={() => void window.contr.restartToUpdate()}
      />
      <Core />
      <ChangeLog current={u?.current} checked={u?.checked} />
    </>
  );
}

/**
 * The Core part: the core's version, the newest one, Check now and the folder (docs/reference/releases.md, "The Core part").
 * Each open of the view runs one check that the core's day cache can answer; Check now asks GitHub again.
 */
function Core() {
  const [c, setC] = useState<CoreState>();
  useEffect(() => {
    void window.contr.core().then(setC);
    void window.contr.checkCore(false);
    return window.contr.onCore(setC);
  }, []);
  const now = useNow();
  return (
    <UpdateCard
      title="Core"
      view={updateView(c, now, "core")}
      current={c?.current}
      labels={{ current: "Core version", newest: "Newest core version", lastCheck: "Last core check" }}
      onCheck={() => void window.contr.checkCore(true)}
    >
      {c?.root && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Folder</span>
          <PathText label="Core folder" path={c.root} />
        </div>
      )}
    </UpdateCard>
  );
}

/** The time now, drawn again each 30 s ("Checked 5m ago"), as the sidebar's ages do. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** One update card (Updates, Core): the version, the newest one with its button, the last check, progress, status and error. */
function UpdateCard({ title, view: v, current, labels, onCheck, onUpdate, onRestart, children }: {
  title: string;
  view: UpdateView;
  current: string | undefined;
  labels: { current: string; newest: string; lastCheck: string };
  onCheck: () => void;
  /** With no handler the Update button does nothing yet (the core's update comes later). */
  onUpdate?: () => void;
  onRestart?: () => void;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-xs font-medium text-muted">{title}</h2>
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-raised px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Version</span>
          <span className="flex items-center gap-3">
            <span aria-label={labels.current} className="font-mono text-[11px] text-muted">{current}</span>
            {v.check && (
              <button type="button" disabled={v.check.disabled} onClick={onCheck} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-hover disabled:opacity-50">
                {v.check.label}
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Newest</span>
          <span className="flex items-center gap-3">
            <span aria-label={labels.newest} className="font-mono text-[11px] text-muted">{v.newest}</span>
            {v.action?.kind === "restart" ? (
              <button type="button" onClick={onRestart} className="rounded-md bg-working px-3 py-1 text-xs text-white">
                {v.action.label}
              </button>
            ) : v.action && (
              <button type="button" disabled={v.action.disabled} onClick={onUpdate} className="rounded-md bg-working px-3 py-1 text-xs text-white disabled:opacity-60">
                {v.action.label}
              </button>
            )}
          </span>
        </div>
        {children}
        {v.lastCheck && <span aria-label={labels.lastCheck} className="text-xs text-muted">{v.lastCheck}</span>}
        {v.progress != null && <progress aria-label="Download" max={100} value={v.progress} className="h-1 w-full" />}
        {v.status && <span role="status" className="text-xs text-muted">{v.status}</span>}
        {v.error && <span role="alert" className="text-xs text-error">{v.error}</span>}
      </div>
    </section>
  );
}
