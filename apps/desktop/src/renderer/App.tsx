import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card, cardShows } from "./chat/card/Card";
import { OwnerCards, useAllOwnerItems, useOwnerItems } from "./chat/owner/OwnerCards";
import { Inbox } from "./inbox/Inbox";
import { SettingsView } from "./settings/SettingsView";
import { blockedAgents } from "../shared/inbox";
import { ChatList, ChatLoading } from "./chat/list/ChatList";
import { Empty } from "./chat/Empty";
import { HelperError } from "./chat/HelperError";
import { ORCHESTRATE_COMMAND, StatusLine, orchestratingText, showsOrchestrate } from "./chat/rows/StatusLine";
import { useBoard } from "./chat/blocks/useBoard";
import { ReplyBox, type Draft } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";
import { TerminalView } from "./terminal/TerminalView";
import { Sidebar, readHidden, saveHidden } from "./sidebar/Sidebar";
import { TopBar, findAgent, nextAfterClose, openTab, readTabs, saveTabs, tabLabel } from "./topbar/TopBar";
import { readShown, readSide, saveShown, saveSide, startAgent, type Side } from "./state/restart";
import type { Sidebar as SidebarData } from "../shared/api";

const NO_ISSUES: number[] = [];

/** The sidebar, the top bar and the selected agent's chat. A switch mounts the chat again: feed, title, reply box and terminal follow. */
export function App() {
  const [sidebar, setSidebar] = useState<SidebarData>({ projects: [], selected: "" });
  useEffect(() => {
    void window.contr.sidebar().then(setSidebar);
    return window.contr.onSidebar(setSidebar);
  }, []);
  // The open tabs. Selecting an agent anywhere opens its tab.
  const [tabs, setTabs] = useState<string[]>(readTabs);
  useEffect(() => saveTabs(tabs), [tabs]);
  // The Chat / Terminal pick is one for the window: it stays when another agent shows and over a restart.
  const [side, setSide] = useState<Side>(readSide);
  useEffect(() => saveSide(side), [side]);
  // At start the stored agent shows again while the sidebar lists it (startAgent); after that, the shown agent is stored.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      if (sidebar.projects.length === 0) return;
      started.current = true;
      const start = startAgent(sidebar, readShown());
      if (start !== sidebar.selected) {
        void window.contr.select(start).then((selected) => setSidebar((s) => ({ ...s, selected })));
        return;
      }
    }
    saveShown(sidebar.selected);
  }, [sidebar]);
  useEffect(() => setTabs((t) => openTab(t, sidebar.selected)), [sidebar.selected]);
  // Titles from hc for tabs with no sidebar entry, read once per terminal.
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    for (const t of tabs) {
      if (findAgent(sidebar, t) || t in titles) continue;
      setTitles((m) => ({ ...m, [t]: "" }));
      void window.contr.tabTitle(t).then((title) => {
        // hc does not list the terminal: a saved tab of a gone agent closes.
        if (title === null) setTabs((open) => open.filter((x) => x !== t));
        else setTitles((m) => ({ ...m, [t]: title }));
      });
    }
  }, [tabs, sidebar, titles]);
  // The Inbox in the main pane (D95) until an agent is selected.
  const [inbox, setInbox] = useState(false);
  // The Settings view in the main pane, from the sidebar foot.
  const [settings, setSettings] = useState(false);
  // The app menu's "Check for Updates…" shows Settings too.
  useEffect(() => window.contr.onOpenSettings(() => setSettings(true)), []);
  const [hidden, setHidden] = useState(readHidden);
  useEffect(() => saveHidden(hidden), [hidden]);
  // With the Inbox or Settings shown, no agent row and no tab looks selected.
  const view = inbox || settings ? { ...sidebar, selected: "" } : sidebar;
  const owner = useAllOwnerItems();
  const blocked = blockedAgents(sidebar.projects);
  const name = (coordinator: string) => findAgent(sidebar, coordinator)?.title || coordinator;
  const select = (terminal: string) => {
    setInbox(false);
    setSettings(false);
    void window.contr.select(terminal).then((selected) => setSidebar((s) => ({ ...s, selected })));
  };
  const close = (terminal: string) => {
    const next = nextAfterClose(tabs, terminal);
    setTabs((t) => t.filter((x) => x !== terminal));
    if (terminal !== sidebar.selected) return;
    if (next) select(next);
    // No tab left: main stops the feed and its per-second reads.
    else void window.contr.select("").then((selected) => setSidebar((s) => ({ ...s, selected })));
  };
  return (
    <div className="flex h-screen bg-canvas text-foreground">
      {!hidden && <Sidebar data={view} onSelect={select} inbox={owner.questions.length + owner.todos.length + blocked.length} inboxShown={inbox && !settings} onInbox={() => { setInbox(true); setSettings(false); }} settingsShown={settings} onSettings={() => setSettings(true)} onHide={() => setHidden(true)} />}
      <main className="flex min-w-0 flex-1 flex-col bg-canvas">
        <TopBar data={view} tabs={tabs} titles={titles} onSelect={select} onClose={close} onReorder={setTabs} onShowSidebar={hidden ? () => setHidden(false) : undefined} right={!inbox && !settings && sidebar.selected && <Switch side={side} onSide={setSide} />} />
        {settings ? <SettingsView /> : inbox ? <Inbox items={owner} blocked={blocked} name={name} onOpen={select} /> : !sidebar.selected ? sidebar.projects.length === 0 && <Empty hcError={sidebar.hcError} /> : <Chat key={sidebar.selected} terminal={sidebar.selected} title={tabLabel(sidebar, sidebar.selected, titles)} side={side} />}
      </main>
    </div>
  );
}

/** The Chat / Terminal switch at the top right of the work area (docs/design/README.md part 3). */
function Switch({ side, onSide }: { side: Side; onSide: (s: Side) => void }): ReactNode {
  const tab = (s: Side, label: string) => (
    <button
      type="button"
      aria-pressed={side === s}
      onClick={() => onSide(s)}
      className={`rounded px-2.5 py-0.5 text-xs ${side === s ? "bg-raised text-foreground" : "text-muted hover:bg-hover"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Chat or Terminal" className="flex shrink-0 gap-0.5 rounded-md border border-border bg-chrome p-0.5 [-webkit-app-region:no-drag]">
      {tab("chat", "Chat")}
      {tab("terminal", "Terminal")}
    </div>
  );
}

/** `title` is the tab's title (`tabLabel`): the reply box names the agent as the tab and the sidebar do, never by its hc name. */
function Chat({ terminal, title, side }: { terminal: string; title: string; side: Side }) {
  const [feed, setFeed] = useState(emptyFeed);
  // Retry listens again: main stops the old feed and starts a new one.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), [attempt]);
  const retry = () => {
    setFeed(emptyFeed);
    setAttempt((n) => n + 1);
  };
  // While the helper is down, the chat cannot send and shows no orchestrator text.
  const down = feed.error !== null;
  const board = useBoard(NO_ISSUES);
  const workers = board?.orchestrating ?? 0;
  const owner = useOwnerItems(terminal);
  const [draft, setDraft] = useState<Draft>();
  const orchestrate = () => setDraft((d) => ({ text: ORCHESTRATE_COMMAND, id: (d?.id ?? 0) + 1 }));
  if (side === "terminal") return <TerminalView />;
  return (
    <>
      {/* The cards, the status line and the reply box keep the chat rows' 16 px side space in a narrow window.
          They come before the chat rows in the DOM, so Tab reaches the reply box first; `order-last` shows them under the rows. */}
      {/* The same scrollbar gutters as the chat list, so the cards, status line and reply box line up with the rows. */}
      {/* Stacked cards scroll in a block of at most 45% of the window; the status line and the reply box stay under it (issue #139). */}
      <div className="order-last flex flex-col overflow-hidden px-4 [scrollbar-gutter:stable_both-edges]">
        {/* `flex-col-reverse` starts the block scrolled to its end: the agent's card, next to the reply box, stays in view. */}
        <div role="group" aria-label="Cards" className="flex max-h-[45vh] min-h-0 flex-col-reverse overflow-y-auto">
          {feed.card && <Card card={feed.card} />}
          {/* One card owns the digit and Enter keys: the agent's card first, as it blocks the agent; else the owner question. */}
          <div><OwnerCards items={owner} keys={!cardShows(feed.card)} /></div>
        </div>
        <StatusLine
          working={feed.working}
          right={down ? undefined : orchestratingText(workers)}
          onOrchestrate={!down && board && showsOrchestrate(feed.agent, workers) ? orchestrate : undefined}
        />
        {/* A disabled fieldset turns off every control of the reply box; the draft stays. */}
        <fieldset disabled={down} className="min-w-0 disabled:opacity-50">
          {/* The box takes the keyboard once the first full answer tells whether a card owns the card keys. */}
          <ReplyBox terminal={terminal} title={title} draft={draft} keyboard={feed.card === undefined ? undefined : !cardShows(feed.card) && owner.questions.length === 0} />
        </fieldset>
      </div>
      {/* The chat list keeps at least 120 px: the cards block gives way first. */}
      {/* The loader covers the empty list until the first answer: the list mounts as before, with no rows. */}
      <div className="relative flex min-h-[120px] flex-1 flex-col">{feed.error ? <HelperError error={feed.error} onRetry={retry} /> : <ChatList rows={feed.rows} />}{!feed.error && !feed.loaded && <ChatLoading />}</div>
    </>
  );
}
