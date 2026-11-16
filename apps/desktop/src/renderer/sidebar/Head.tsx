import { Check, ChevronDown, PanelLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Machine } from "../../shared/api";

const STATE: Record<string, string> = { unreachable: "unreachable", "needs-login": "needs login", needs_login: "needs login", rebuilt: "rebuilt" };

const icon = "flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover [-webkit-app-region:no-drag]";

/**
 * The sidebar head (docs/design/recipe-herdr.md, the head): the app name, the machine switch, search and the
 * sidebar toggle. Search, the toggle and "Add machine…" do nothing yet. The pick does not filter the Projects
 * list yet: the app reads agents of this computer only.
 */
export function Head() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => void window.contr.machines().then(setMachines), [open]);
  const shown = machines.some((m) => m.name === picked) ? picked : null;
  const pick = (name: string | null) => {
    setPicked(name);
    setOpen(false);
  };
  const row = (name: string | null, label: string, state?: string) => (
    <li key={label}>
      <button type="button" role="menuitemradio" aria-checked={shown === name} onClick={() => pick(name)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {state && STATE[state] && <span className="text-xs text-dim">{STATE[state]}</span>}
        {shown === name && <Check aria-hidden className="size-3.5 text-muted" />}
      </button>
    </li>
  );
  return (
    <header className={`relative flex h-[46px] shrink-0 items-center gap-1 pr-2.5 [-webkit-app-region:drag] ${window.contr.platform === "darwin" ? "pl-[76px]" : "pl-5"}`}>
      <span className="text-sm font-semibold">contr</span>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Machine" onClick={() => setOpen((o) => !o)} className="flex h-[26px] min-w-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:bg-hover [-webkit-app-region:no-drag]">
        <span className="truncate">{shown ?? "This computer"}</span>
        <ChevronDown aria-hidden className="size-3 shrink-0" />
      </button>
      <span className="flex-1" />
      <button type="button" aria-label="Search" title="Search" className={icon}><Search aria-hidden className="size-4" /></button>
      <button type="button" aria-label="Hide sidebar" title="Hide sidebar" className={icon}><PanelLeft aria-hidden className="size-4" /></button>
      {open && (
        <ul role="menu" aria-label="Machines" className="absolute top-10 left-3 z-10 w-[240px] rounded-xl border border-border bg-raised p-1 shadow-lg [-webkit-app-region:no-drag]">
          {row(null, "This computer")}
          {machines.map((m) => row(m.name, m.name, m.state))}
          <li role="separator" className="my-1 border-t border-border" />
          <li><button type="button" role="menuitem" className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] hover:bg-hover">Add machine…</button></li>
        </ul>
      )}
    </header>
  );
}
