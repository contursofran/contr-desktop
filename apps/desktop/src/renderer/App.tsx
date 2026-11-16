import { useEffect, useState, type ReactNode } from "react";
import { Card } from "./chat/card/Card";
import { ChatList } from "./chat/list/ChatList";
import { ORCHESTRATE_COMMAND, StatusLine, orchestratingText, showsOrchestrate } from "./chat/rows/StatusLine";
import { useBoard } from "./chat/blocks/useBoard";
import { ReplyBox, type Draft } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";
import { TerminalView } from "./terminal/TerminalView";
import { Sidebar } from "./sidebar/Sidebar";
import { TopBar, nextAfterClose, openTab } from "./topbar/TopBar";
import type { Sidebar as SidebarData } from "../shared/api";

type Side = "chat" | "terminal";

const NO_ISSUES: number[] = [];

/** The sidebar, the top bar and the selected agent's chat. A switch mounts the chat again: feed, title, reply box and terminal follow. */
export function App() {
  const [sidebar, setSidebar] = useState<SidebarData>({ projects: [], selected: "" });
  useEffect(() => {
    void window.contr.sidebar().then(setSidebar);
    return window.contr.onSidebar(setSidebar);
  }, []);
  // The open tabs. Selecting an agent anywhere opens its tab.
  const [tabs, setTabs] = useState<string[]>([]);
  const [side, setSide] = useState<Side>("chat");
  useEffect(() => setTabs((t) => openTab(t, sidebar.selected)), [sidebar.selected]);
  const select = (terminal: string) => {
    setSide("chat");
    void window.contr.select(terminal).then((selected) => setSidebar((s) => ({ ...s, selected })));
  };
  const close = (terminal: string) => {
    const next = nextAfterClose(tabs, terminal);
    setTabs((t) => t.filter((x) => x !== terminal));
    if (terminal !== sidebar.selected) return;
    if (next) select(next);
    else setSidebar((s) => ({ ...s, selected: "" }));
  };
  return (
    <div className="flex h-screen bg-canvas text-foreground">
      <Sidebar data={sidebar} onSelect={select} />
      <main className="flex min-w-0 flex-1 flex-col bg-canvas">
        <TopBar data={sidebar} tabs={tabs} onSelect={select} onClose={close} right={sidebar.selected && <Switch side={side} onSide={setSide} />} />
        {sidebar.selected && <Chat key={sidebar.selected} side={side} />}
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
      className={`rounded px-2.5 py-0.5 text-xs ${side === s ? "bg-selected text-foreground" : "text-muted hover:bg-hover"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Chat or Terminal" className="flex shrink-0 gap-0.5 rounded-md border border-border bg-raised p-0.5 [-webkit-app-region:no-drag]">
      {tab("chat", "Chat")}
      {tab("terminal", "Terminal")}
    </div>
  );
}

function Chat({ side }: { side: Side }) {
  const [feed, setFeed] = useState(emptyFeed);
  const [title, setTitle] = useState("");
  useEffect(() => void window.contr.title().then(setTitle), []);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), []);
  const board = useBoard(NO_ISSUES);
  const workers = board?.orchestrating ?? 0;
  const [draft, setDraft] = useState<Draft>();
  const orchestrate = () => setDraft((d) => ({ text: ORCHESTRATE_COMMAND, id: (d?.id ?? 0) + 1 }));
  if (side === "terminal") return <TerminalView />;
  return (
    <>
      {feed.error && (
        <p role="alert" className="px-4 py-2 text-sm text-blocked">
          {feed.error.code}: {feed.error.message}
        </p>
      )}
      <ChatList rows={feed.rows} />
      {feed.card && <Card card={feed.card} />}
      <StatusLine
        working={feed.working}
        right={orchestratingText(workers)}
        onOrchestrate={board && showsOrchestrate(feed.agent, workers) ? orchestrate : undefined}
      />
      <ReplyBox title={title} draft={draft} />
    </>
  );
}
