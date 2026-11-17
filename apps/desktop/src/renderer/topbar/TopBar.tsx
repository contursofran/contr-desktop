import { PanelLeft, Plus, Sparkle, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { Sidebar, SidebarAgent } from "../../shared/api";
import { TabOrderItem, TabOrderRoot } from "./tab-order-parts";
import { Tip } from "../ui/Tip";
import { AgentIcon } from "../ui/AgentIcon";
import { Spinner } from "../chat/rows/Spinner";

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

/** The `scrollLeft` that puts an item (`left`, `width` in the row's content) in a row of `width` scrolled to `scroll`: the least move. */
export function scrollToShow(row: { width: number; scroll: number }, item: { left: number; width: number }): number {
  if (item.left < row.scroll) return item.left;
  if (item.left + item.width > row.scroll + row.width) return item.left + item.width - row.width;
  return row.scroll;
}

/**
 * The top strip (docs/design/README.md part 2): the drag area of the hidden title bar.
 * Herdr's normal tab bar (its `tabs` mod): tabs from the left, then an inert + (new tab comes later). On the right: `right`.
 * Drag a tab, or press Alt with Left, Right, Home or End on it, to move it (tab-order.ts).
 * As herdr-contr-tabs: an agent's tab has its program icon (ui/AgentIcon, one-color glyphs in `muted`),
 * then the title, then the loader in `working` while it works or a 6 px dot in `done` or `blocked`.
 * A tab with no agent keeps the sparkle: herdr-contr takes that icon from Herdr's program table, which we do not have.
 * A label grows to 170 px; tabs do not shrink, the tab row scrolls sideways when it is full, with a thin scrollbar as Herdr's:
 * a 3 px `::-webkit-scrollbar` that takes its own room under the tabs (an overlay one drew over the shown tab),
 * and it scrolls the shown tab into view when the shown tab, the tabs or the row's width change (Herdr: `scroll_to_item(active)`).
 * With the sidebar hidden (`onShowSidebar`), the bar starts with the "Show sidebar" toggle, and on macOS it pads 76 px
 * at the left for the window buttons, as Herdr's bar and the sidebar head do.
 */
export function TopBar({ data, tabs, titles, onSelect, onClose, onReorder, onShowSidebar, right }: {
  data: Sidebar;
  tabs: string[];
  titles: Record<string, string>;
  onSelect: (terminal: string) => void;
  onClose: (terminal: string) => void;
  onReorder: (tabs: string[]) => void;
  onShowSidebar?: () => void;
  right?: ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const show = () => {
      const tab = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.parentElement;
      if (!tab) return;
      const left = tab.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      el.scrollLeft = scrollToShow({ width: el.clientWidth, scroll: el.scrollLeft }, { left, width: tab.offsetWidth });
    };
    show();
    const size = new ResizeObserver(show);
    size.observe(el);
    return () => size.disconnect();
  }, [data.selected, tabs, titles]);
  const mac = window.contr.platform === "darwin";
  return (
    <div className={`flex h-10 shrink-0 items-center gap-[3px] border-b border-border bg-chrome pr-2.5 [-webkit-app-region:drag] ${onShowSidebar && mac ? "pl-[76px]" : "pl-2.5"}`}>
      {onShowSidebar && (
        <Tip label="Show sidebar">
          <button type="button" aria-label="Show sidebar" onClick={onShowSidebar} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover [-webkit-app-region:no-drag]">
            <PanelLeft aria-hidden className="size-4" />
          </button>
        </Tip>
      )}
      <TabOrderRoot value={tabs} onValueChange={(order) => onReorder(order)} aria-label="Tabs" className="flex min-w-0 items-center self-stretch gap-[3px] [-webkit-app-region:no-drag]">
        {(state) => (
          <>
            <div ref={row} data-tab-row className="flex min-w-0 items-center self-stretch gap-[3px] overflow-x-auto [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
              {state.order.map((t) => {
              const shown = t === data.selected;
              const title = tabLabel(data, t, titles);
              const agent = findAgent(data, t);
              return (
                <TabOrderItem key={t} value={t} className={`flex h-[29px] shrink-0 touch-none select-none items-center gap-[7px] rounded-[7px] border px-2.5 text-[12.8px] hover:bg-hover data-grabbed:w-0.5 data-grabbed:border-0 data-grabbed:px-0 data-grabbed:self-stretch data-grabbed:h-auto data-grabbed:my-1 data-grabbed:bg-working data-grabbed:*:hidden ${shown ? "border-border bg-raised text-foreground" : "border-transparent text-muted"}`}>
                  <Tip label={title}>
                    <button type="button" role="tab" aria-selected={shown} onClick={() => onSelect(t)} className="flex min-w-0 items-center gap-[7px]">
                      {agent ? <AgentIcon kind={agent.kind} size={14} color="var(--color-muted)" /> : <Sparkle aria-hidden className="size-3.5 shrink-0" />}
                      <span data-title className="max-w-[170px] truncate">{title}</span>
                    </button>
                  </Tip>
                  {agent?.state === "working" && <Spinner size={12} className="text-working" />}
                  {(agent?.state === "blocked" || agent?.state === "done") && (
                    <span role="img" aria-label={agent.state} data-state={agent.state} className={`size-1.5 shrink-0 rounded-full ${agent.state === "done" ? "bg-done" : "bg-blocked"}`} />
                  )}
                  {shown && (
                    <button type="button" data-tab-close aria-label={`Close ${title}`} onClick={() => onClose(t)} className="flex text-dim hover:text-foreground">
                      <X aria-hidden className="size-3" />
                    </button>
                  )}
                </TabOrderItem>
              );
            })}
            </div>
            <Tip label="New tab (not yet)">
              <button type="button" aria-label="New tab" aria-disabled="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px] text-faint">
                <Plus aria-hidden className="size-3.5" />
              </button>
            </Tip>
          </>
        )}
      </TabOrderRoot>
      <div className="flex-1" />
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
