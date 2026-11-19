import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useEffect, useState, type ReactNode } from "react";
import type { CoreState, Settings, ThemeChoice, UpdateState } from "../../shared/api";
import { ChangeLog } from "./ChangeLog";
import { buttonClass, Group, PathValue, Row, Value } from "./rows";
import { updateView, type UpdateView } from "./updateView";

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** The Settings view in the main pane, as groups of rows (#187): the theme, the updates, the core, the change log, and the helper path. All colors from the theme tokens. */
export function SettingsView() {
  const [data, setData] = useState<Settings>();
  const [core, setCore] = useState<CoreState>();
  const source = core?.source;
  useEffect(() => {
    void window.contr.core().then(setCore);
    void window.contr.checkCore(false);
    return window.contr.onCore(setCore);
  }, []);
  useEffect(() => {
    if (source) void window.contr.settings().then(setData);
  }, [source]);
  const choose = (theme: ThemeChoice) => {
    void window.contr.setTheme(theme).then((t) => setData((d) => d && { ...d, theme: t }));
  };
  return (
    <section aria-label="Settings" className="min-h-0 flex-1 overflow-y-auto px-14 pt-7 pb-5">
      <div className="mx-auto flex w-full max-w-[640px] flex-col">
        <h1 className="pb-3.5 text-base font-semibold text-ink-100">Settings</h1>
        <Group title="Appearance">
          <Row label="Theme">
            <SegmentedControl<ThemeChoice>
              aria-label="Theme"
              value={data?.theme ?? null}
              onValueChange={(v) => v && choose(v)}
              className="relative isolate flex gap-0.5 rounded-lg bg-canvas p-0.5 shadow-[inset_0_0_0_1px_var(--color-border)]"
            >
              <SegmentedControlIndicator className="absolute -z-10 top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-md bg-selected shadow-[var(--shadow-selected)]" />
              {THEMES.map((t) => (
                <SegmentedControlItem
                  key={t.value}
                  value={t.value}
                  className="relative rounded-md px-2.5 py-[3px] text-[11.5px] text-dim outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-foreground data-checked:text-ink-100 data-checked:hover:bg-transparent"
                >
                  {t.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Row>
        </Group>
        <Updates core={core} />
        <Group title="Helper">
          <Row label="Path">
            <PathValue label="Helper path" path={data?.helper ?? ""} />
          </Row>
        </Group>
      </div>
    </section>
  );
}

/**
 * The Updates section: this version, the newest one, Check now, and the Update button (installs the .zip, else opens the .dmg).
 * Each open of the view runs one check. The change log stands under it, after the Core part.
 */
function Updates({ core }: { core?: CoreState }) {
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
      <Core state={core} />
      <ChangeLog current={u?.current} checked={u?.checked} />
    </>
  );
}

/**
 * The Core part: the core's version, the newest one, Check now and the folder (docs/reference/releases.md, "The Core part").
 * Each open of the view runs one check that the core's day cache can answer; Check now asks GitHub again.
 */
function Core({ state: c }: { state?: CoreState }) {
  const now = useNow();
  return (
    <UpdateCard
      title="Core"
      view={updateView(c, now, "core")}
      current={c?.current}
      labels={{ current: "Core version", newest: "Newest core version", lastCheck: "Last core check" }}
      onCheck={() => void window.contr.checkCore(true)}
      onUpdate={() => void window.contr.updateCore()}
    >
      {c?.root && (
        <Row label="Folder">
          <PathValue label="Core folder" path={c.root} />
        </Row>
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

/** One update group (Updates, Core): the last check and Check now in its head, then rows: the version, the newest one with its button, progress, status and error. */
function UpdateCard({ title, view: v, current, labels, onCheck, onUpdate, onRestart, children }: {
  title: string;
  view: UpdateView;
  current: string | undefined;
  labels: { current: string; newest: string; lastCheck: string };
  onCheck: () => void;
  onUpdate: () => void;
  onRestart?: () => void;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <Group
        title={title}
        aside={
          <>
            {v.lastCheck && <span aria-label={labels.lastCheck} className="font-mono text-[11px] text-dim">{v.lastCheck}</span>}
            {v.check && (
              <button type="button" disabled={v.check.disabled} onClick={onCheck} className={buttonClass()}>
                {v.check.label}
              </button>
            )}
          </>
        }
      >
        <Row label="Version">
          <Value label={labels.current}>{current}</Value>
        </Row>
        <Row label="Newest">
          <Value label={labels.newest}>{v.newest}</Value>
          {v.action?.kind === "restart" ? (
            <button type="button" onClick={onRestart} className={buttonClass(true)}>
              {v.action.label}
            </button>
          ) : v.action && (
            <button type="button" disabled={v.action.disabled} onClick={onUpdate} className={buttonClass(true)}>
              {v.action.label}
            </button>
          )}
        </Row>
        {children}
        {v.progress != null && (
          <Row>
            <progress aria-label="Download" max={100} value={v.progress} className="h-1 w-full" />
          </Row>
        )}
        {v.status && (
          <Row>
            <span role="status" className="text-xs text-muted">{v.status}</span>
          </Row>
        )}
        {v.error && (
          <Row>
            <span role="alert" className="text-xs text-error">{v.error}</span>
          </Row>
        )}
      </Group>
    </section>
  );
}
