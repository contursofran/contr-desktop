import { Check, ChevronDown, PanelLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuItemIndicator, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import type { Machine } from "../../shared/api";
import { Tip } from "../ui/Tip";

const STATE: Record<string, string> = { unreachable: "unreachable", "needs-login": "needs login", needs_login: "needs login", rebuilt: "rebuilt" };

const icon = "flex size-7 items-center justify-center rounded-lg text-muted hover:bg-hover [-webkit-app-region:no-drag]";

/**
* The sidebar head (docs/design/recipe-herdr.md, the head): the app name, the machine switch, search and the
 * sidebar toggle on the first row, the machine switch on its own row under it, so the
 * machine name reads in full (decision: the PR of issue 50). Search, the toggle and "Add machine…" do nothing yet. The pick does not filter the Projects
 * list yet: the app reads agents of this computer only.
 */
export function Head() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => void window.contr.machines().then(setMachines), []);
  const shown = machines.some((m) => m.name === picked) ? picked : null;
  const item = "flex h-8 w-full cursor-default items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none data-highlighted:bg-hover";
  const row = (name: string | null, label: string, state?: string) => (
    <MenuRadioItem key={label} value={name ?? ""} closeOnSelect className={item}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {state && STATE[state] && <span className="text-xs text-dim">{STATE[state]}</span>}
      <MenuItemIndicator><Check aria-hidden className="size-3.5 text-muted" /></MenuItemIndicator>
    </MenuRadioItem>
  );
  return (
    <header className="relative shrink-0">
      <div className={`flex h-[46px] items-center gap-1 pr-2.5 [-webkit-app-region:drag] ${window.contr.platform === "darwin" ? "pl-[76px]" : "pl-5"}`}>
        <span className="text-sm font-semibold">contr</span>
        <span className="flex-1" />
        <Tip label="Search"><button type="button" aria-label="Search" className={icon}><Search aria-hidden className="size-4" /></button></Tip>
        <Tip label="Hide sidebar"><button type="button" aria-label="Hide sidebar" className={icon}><PanelLeft aria-hidden className="size-4" /></button></Tip>
      </div>
      <div className="flex px-3 pb-1">
        <Menu onOpenChange={(open) => open && void window.contr.machines().then(setMachines)}>
          <MenuTrigger aria-label="Machine" className="flex h-[26px] min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:bg-hover">
            <span data-testid="machine-label" className="truncate">{shown ?? "This computer"}</span>
            <ChevronDown aria-hidden className="size-3 shrink-0" />
          </MenuTrigger>
          <MenuContent side="bottom" align="start" sideOffset={4} className="m-0 w-[240px] rounded-xl border border-border bg-raised p-1 text-foreground shadow-lg [-webkit-app-region:no-drag]">
            <MenuRadioGroup value={shown ?? ""} onValueChange={(v) => setPicked(v ? String(v) : null)}>
              {row(null, "This computer")}
              {machines.map((m) => row(m.name, m.name, m.state))}
            </MenuRadioGroup>
            <MenuSeparator className="my-1 border-t border-border" />
            <MenuItem className={item}>Add machine…</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
