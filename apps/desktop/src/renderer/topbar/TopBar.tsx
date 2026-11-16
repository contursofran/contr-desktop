import { Plus, Sparkle, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Sidebar, SidebarAgent } from "../../shared/api";
import { TabOrderItem, TabOrderRoot } from "./tab-order-parts";

/** The agent with this terminal anywhere in the sidebar's tree, or undefined. */
export function findAgent(data: Sidebar, terminal: string): SidebarAgent | undefined {
  const walk = (agents: SidebarAgent[]): SidebarAgent | undefined => {
    for (const a of agents) {
      if (a.terminal === terminal) return a;
      const w = walk(a.workers);
      if (w) return w;
    }
    return undefined;
  };
  for (const p of data.projects) {
    const a = walk(p.agents);
    if (a) return a;
  }
  return undefined;
}

/** A tab's label: the sidebar entry's title, else the title read from hc (`titles`), else "" while it loads. Never the terminal id. */
export function tabLabel(data: Sidebar, terminal: string, titles: Record<string, string>): string {
  return findAgent(data, terminal)?.title ?? titles[terminal] ?? "";
}

/** The open tabs with `selected` added at the end when it is not open yet. */
export function openTab(tabs: string[], selected: string): string[] {
  return !selected || tabs.includes(selected) ? tabs : [...tabs, selected];
}

/** The tab to show after `closed` closes: the next one, else the one before, else none. */
export function nextAfterClose(tabs: string[], closed: string): string {
  const i = tabs.indexOf(closed);
  const rest = tabs.filter((t) => t !== closed);
  return rest[Math.min(i, rest.length - 1)] ?? "";
}

/**
 * The top strip (docs/design/README.md part 2): the drag area of the hidden title bar.
 * Centered: one tab per open agent and an inert + (new tab comes later). On the right: `right`.
 * Drag a tab, or press Alt with Left, Right, Home or End on it, to move it (tab-order.ts).
 * A label grows to 170 px (recipe-herdr.md); tabs shrink only when the bar is full, then it scrolls.
 */
export function TopBar({ data, tabs, titles, onSelect, onClose, onReorder, right }: {
  data: Sidebar;
  tabs: string[];
  titles: Record<string, string>;
  onSelect: (terminal: string) => void;
  onClose: (terminal: string) => void;
  onReorder: (tabs: string[]) => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 px-3 [-webkit-app-region:drag]">
      <div className="flex min-w-0 flex-1 justify-center">
        <TabOrderRoot value={tabs} onValueChange={(order) => onReorder(order)} aria-label="Tabs" className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-raised p-0.5 [-webkit-app-region:no-drag]">
          {(state) => (
            <>
              {state.order.map((t) => {
                const shown = t === data.selected;
                const title = tabLabel(data, t, titles);
                return (
                  <TabOrderItem key={t} value={t} className={`flex h-7 min-w-[72px] touch-none select-none items-center rounded-full text-[13px] data-grabbed:opacity-40 ${shown ? "bg-selected font-semibold text-foreground" : "text-muted hover:bg-hover"}`}>
                    <button type="button" role="tab" aria-selected={shown} title={title} onClick={() => onSelect(t)} className="flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1">
                      <Sparkle aria-hidden className="size-3.5 shrink-0" />
                      <span className="max-w-[170px] truncate">{title}</span>
                    </button>
                    <button type="button" data-tab-close aria-label={`Close ${title}`} onClick={() => onClose(t)} className="mr-1 rounded-full p-0.5 hover:bg-hover">
                      <X aria-hidden className="size-3" />
                    </button>
                  </TabOrderItem>
                );
              })}
              <button type="button" aria-label="New tab" disabled title="New tab (not yet)" className="rounded-full p-1.5 text-dim">
                <Plus aria-hidden className="size-3.5" />
              </button>
            </>
          )}
        </TabOrderRoot>
      </div>
      {right}
    </div>
  );
}

const TABS_KEY = "tabs.open";

/** The open tabs in their order, kept in localStorage `tabs.open` over restarts. */
export function readTabs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(TABS_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function saveTabs(tabs: string[]): void {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}
