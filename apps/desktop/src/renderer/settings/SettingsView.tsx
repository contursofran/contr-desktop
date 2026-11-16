import { useEffect, useState } from "react";
import type { Settings, ThemeChoice } from "../../shared/api";

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/** The Settings view in the main pane: the theme choice and the helper path. All colors from the theme tokens. */
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
            <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-lg bg-canvas p-0.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={data?.theme === t.value}
                  onClick={() => choose(t.value)}
                  className={`rounded-md px-3 py-1 text-xs ${data?.theme === t.value ? "bg-selected text-foreground" : "text-muted hover:bg-hover"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
