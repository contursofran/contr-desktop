import { Check, PanelLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuItemIndicator, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import type { Machine } from "../../shared/api";
import { Tip } from "../ui/Tip";

const STATE: Record<string, string> = { unreachable: "unreachable", "needs-login": "needs login", needs_login: "needs login", rebuilt: "rebuilt" };

const icon = "flex size-[26px] items-center justify-center rounded-lg text-dim hover:bg-hover hover:text-muted [-webkit-app-region:no-drag]";
/** The machine the app reads agents of. */
const MACHINE = "This computer";

const inert = "flex size-[26px] items-center justify-center rounded-lg text-faint [-webkit-app-region:no-drag]";

/**
* The sidebar head (docs/design/redesign, `.side-top`): one 40 px row with the app name, the machine switch, search and the
 * sidebar toggle. A long machine name is cut with "…"; its tooltip and its label have the full name (owner, D142). The toggle hides the sidebar (`onHide`); the top bar then has the
 * toggle that shows it. Search and "Add machine…" are inert: `aria-disabled`, `faint`, "(not yet)".
 * The app reads agents of this computer only, so the other machines are inert as "Add machine…", with "(not yet)",
 * and the label stays "This computer": a picked machine over this computer's agents would be wrong data.
 */
export function Head({ onHide }: { onHide: () => void }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  useEffect(() => void window.contr.machines().then(setMachines), []);
  const item = "flex h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none data-highlighted:bg-hover";
  const row = (name: string | null, label: string, state?: string) => (
    <MenuRadioItem key={label} value={name ?? ""} disabled={name !== null} closeOnSelect className={`${item} ${name === null ? "" : "text-faint aria-disabled:data-highlighted:bg-transparent"}`}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {state && STATE[state] && <span className="text-xs text-dim">{STATE[state]}</span>}
      <MenuItemIndicator><Check aria-hidden className="size-3.5 text-muted" /></MenuItemIndicator>
    </MenuRadioItem>
  );
  return (
    <header className="relative shrink-0">
      <div className={`flex h-10 items-center gap-2 pr-2 [-webkit-app-region:drag] ${window.contr.platform === "darwin" ? "pl-[76px]" : "pl-5"}`}>
        <span className="shrink-0 text-[13px] font-semibold text-ink-100">contr</span>
        <Menu onOpenChange={(open) => open && void window.contr.machines().then(setMachines)}>
          <Tip label={MACHINE}>
            {/* The mock's ".machine": 12 px, the "▾" in the text, cut with "…". `dim`, not the mock's ink-45: decision 198. */}
            <MenuTrigger aria-label={`Machine, ${MACHINE}`} className="flex min-w-0 items-center rounded-md text-xs text-dim hover:text-muted [-webkit-app-region:no-drag]">
              <span data-testid="machine-label" className="truncate after:content-['_▾']">{MACHINE}</span>
            </MenuTrigger>
          </Tip>
          <MenuContent side="bottom" align="start" sideOffset={4} className="m-0 w-[240px] rounded-xl border border-float-line bg-raised p-1 text-foreground shadow-[var(--shadow-float)] [-webkit-app-region:no-drag]">
            <MenuRadioGroup value="">
              {row(null, MACHINE)}
              {machines.map((m) => <Tip key={m.name} label={`${m.name} (not yet)`} side="right">{row(m.name, m.name, m.state)}</Tip>)}
            </MenuRadioGroup>
            <MenuSeparator className="my-1 border-t border-border" />
            <Tip label="Add machine (not yet)" side="right">
              <MenuItem disabled className={`${item} text-faint aria-disabled:data-highlighted:bg-transparent`}>Add machine…</MenuItem>
            </Tip>
          </MenuContent>
        </Menu>
        <span className="flex-1" />
        <Tip label="Search (not yet)"><button type="button" aria-label="Search" aria-disabled="true" className={inert}><Search aria-hidden strokeWidth={1.6} className="size-3.5" /></button></Tip>
        <Tip label="Hide sidebar"><button type="button" aria-label="Hide sidebar" onClick={onHide} className={icon}><PanelLeft aria-hidden strokeWidth={1.6} className="size-3.5" /></button></Tip>
      </div>
    </header>
  );
}
