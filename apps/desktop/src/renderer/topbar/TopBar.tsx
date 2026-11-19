import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Tabs, TabsList, TabsTab } from "@ui-sdk/react/tabs";
import { PanelLeft, Plus, Sparkle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Sidebar, SidebarAgent, TerminalKind } from "../../shared/api";
import { TabOrderItem, TabOrderRoot } from "./tab-order-parts";
import { Tip } from "../ui/Tip";
import { AgentIcon } from "../ui/AgentIcon";
import { StatusGlyph } from "../ui/StatusGlyph";

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
 * The `scrollLeft` that puts an item (`left`, `width` in the row's content) in a row of `width` scrolled to `scroll`: the least move.
 * An item wider than the row shows from its start.
 */
export function scrollToShow(row: { width: number; scroll: number }, item: { left: number; width: number }): number {
  if (item.left < row.scroll || item.width > row.width) return item.left;
  if (item.left + item.width > row.scroll + row.width) return item.left + item.width - row.width;
  return row.scroll;
}

/**
 * The tab bar (docs/design/redesign/chat-screen.html): the drag area of the hidden title bar, on the window fill.
 * Herdr's normal tab bar (its `tabs` mod): tabs from the left, then + for a new terminal.
 * Drag a tab, or press Alt with Left, Right, Home or End on it, to move it (tab-order.ts).
 * The redesign (#180): an agent's tab has its program icon (ui/AgentIcon, Claude's pet in `--claude`),
 * then the title, then the status glyph while it works or needs the owner, or a 6 px dot in `done` while unread.
 * The shown tab has the sidebar's fill and a faint inset line.
 * A tab with no agent keeps the sparkle: herdr-contr takes that icon from Herdr's program table, which we do not have.
 * A tab is at most `--tab-max-width` (180 px, tokens.css) wide: a longer title is cut with "…" and its tooltip has the full title.
 * Tabs do not shrink, the tab row scrolls sideways when it is full, with a thin scrollbar as Herdr's.
 * A tab is at most as wide as the row: in a narrower row its label truncates. The scrollbar is
 * a 3 px `::-webkit-scrollbar` that takes its own room under the tabs (an overlay one drew over the shown tab),
 * and it scrolls the shown tab into view when the shown tab, the tabs or the row's width change (Herdr: `scroll_to_item(active)`).
 * With the sidebar hidden (`onShowSidebar`), the bar starts with the "Show sidebar" toggle, and on macOS it pads 76 px
 * at the left for the window buttons, as Herdr's bar and the sidebar head do.
 */
export function TopBar({ data, tabs, titles, onSelect, onClose, onReorder, onStart, starting, onShowSidebar }: {
  data: Sidebar;
  tabs: string[];
  titles: Record<string, string>;
  onSelect: (terminal: string) => void;
  onClose: (terminal: string) => void;
  onReorder: (tabs: string[]) => void;
  onStart: (kind: TerminalKind) => void;
  starting: boolean;
  onShowSidebar?: () => void;
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
    <Tabs
      value={data.selected || null}
      activation="manual"
      onValueChange={(terminal, details) => {
        if (terminal && details.reason === "item-press") onSelect(terminal);
      }}
      className={`flex h-10 shrink-0 items-center gap-0.5 border-b border-hairline bg-canvas pr-2.5 [-webkit-app-region:drag] ${onShowSidebar && mac ? "pl-[76px]" : "pl-2.5"}`}>
      {onShowSidebar && (
        <Tip label="Show sidebar">
          <button type="button" aria-label="Show sidebar" onClick={onShowSidebar} className="flex size-[26px] shrink-0 items-center justify-center rounded-lg text-dim hover:bg-hover hover:text-muted [-webkit-app-region:no-drag]">
            <PanelLeft aria-hidden strokeWidth={1.6} className="size-3.5" />
          </button>
        </Tip>
      )}
      <div className="flex min-w-0 items-center self-stretch gap-0.5 [-webkit-app-region:no-drag]">
        <TabOrderRoot
          ref={row}
          value={tabs}
          onValueChange={onReorder}
          render={(props) => (
            <TabsList {...props} aria-label="Tabs" data-tab-row className="flex min-w-0 items-center self-stretch gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:h-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border" />
          )}
        >
          {({ order }) => order.map((t) => {
            const shown = t === data.selected;
            const title = tabLabel(data, t, titles);
            const agent = findAgent(data, t);
            return (
              <TabOrderItem key={t} value={t} className={`flex h-7 max-w-[min(100%,var(--tab-max-width))] shrink-0 touch-none select-none items-center gap-2 rounded-lg px-2.5 text-[12.5px] data-grabbed:w-0.5 data-grabbed:px-0 data-grabbed:self-stretch data-grabbed:h-auto data-grabbed:my-1 data-grabbed:bg-working data-grabbed:shadow-none data-grabbed:*:hidden ${shown ? "bg-chrome text-ink-100 shadow-[inset_0_0_0_1px_var(--panel-line)]" : "text-dim hover:bg-hover hover:text-muted"}`}>
                <Tip label={title}>
                  <TabsTab value={t} className="flex min-w-0 items-center gap-2">
                    {agent ? <AgentIcon kind={agent.kind} size={15} color="var(--color-muted)" /> : <Sparkle aria-hidden className="size-3.5 shrink-0" />}
                    <span data-title className="truncate">{title}</span>
                  </TabsTab>
                </Tip>
                {agent?.state === "working" && <StatusGlyph state="working" small />}
                {agent?.state === "blocked" && <StatusGlyph state="blocked" small />}
                {agent?.state === "done" && <span role="img" aria-label="done" data-state="done" className="size-1.5 shrink-0 rounded-full bg-done" />}
                {shown && (
                  <button type="button" data-tab-close aria-label={`Close ${title}`} onClick={() => onClose(t)} className="flex text-dim hover:text-foreground">
                    <X aria-hidden strokeWidth={1.8} className="size-2.5" />
                  </button>
                )}
              </TabOrderItem>
            );
          })}
        </TabOrderRoot>
        <NewTabMenu onStart={onStart} starting={starting} />
      </div>
      <div className="flex-1" />
    </Tabs>
  );
}

const PROGRAMS = [["claude", "Claude Code"], ["codex", "Codex"], ["shell", "Shell"]] as const;

function NewTabMenu({ onStart, starting }: { onStart: (kind: TerminalKind) => void; starting: boolean }) {
  const first = useRef<HTMLDivElement>(null);
  return (
    <Menu onOpenChangeComplete={(open) => open && first.current?.focus()}>
      <Tip label="New tab">
        <MenuTrigger
          aria-label="New tab"
          shortcut="mod+t"
          disabled={starting}
          focusableWhenDisabled
          className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px] text-dim hover:bg-hover hover:text-muted focus-visible:ring-1 focus-visible:ring-foreground"
        >
          <Plus aria-hidden className="size-3.5" />
        </MenuTrigger>
      </Tip>
      <MenuContent aria-label="New tab" side="bottom" align="start" sideOffset={4} className="m-0 min-w-32 rounded-xl border border-float-line bg-raised p-1 text-foreground shadow-[var(--shadow-float)] [-webkit-app-region:no-drag]">
        {PROGRAMS.map(([kind, label], i) => (
          <MenuItem
            key={kind}
            ref={i === 0 ? first : undefined}
            value={kind}
            onSelect={() => onStart(kind)}
            className="flex h-8 cursor-default items-center whitespace-nowrap rounded-md px-2 text-[13px] outline-none data-highlighted:bg-hover focus:bg-hover"
          >
            {label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
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
