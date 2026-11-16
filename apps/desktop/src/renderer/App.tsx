import { useEffect, useState } from "react";
import { ChatList } from "./chat/list/ChatList";
import { ORCHESTRATE_COMMAND, StatusLine, orchestratingText, showsOrchestrate } from "./chat/rows/StatusLine";
import { useBoard } from "./chat/blocks/useBoard";
import { ReplyBox, type Draft } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";
import { TerminalView } from "./terminal/TerminalView";
import { Sidebar } from "./sidebar/Sidebar";
import type { Sidebar as SidebarData } from "../shared/api";

type Side = "chat" | "terminal";

const NO_ISSUES: number[] = [];

/** The sidebar and the selected agent's chat. A switch mounts the chat again: feed, title, reply box and terminal follow. */
export function App() {
  const [sidebar, setSidebar] = useState<SidebarData>({ projects: [], selected: "" });
  useEffect(() => {
    void window.contr.sidebar().then(setSidebar);
    return window.contr.onSidebar(setSidebar);
  }, []);
  const select = (terminal: string) =>
    void window.contr.select(terminal).then((selected) => setSidebar((s) => ({ ...s, selected })));
  return (
    <div className="flex h-screen bg-canvas text-foreground">
      <Sidebar data={sidebar} onSelect={select} />
      {sidebar.selected && <Chat key={sidebar.selected} />}
    </div>
  );
}

function Chat() {
  const [feed, setFeed] = useState(emptyFeed);
  const [title, setTitle] = useState("");
  useEffect(() => void window.contr.title().then(setTitle), []);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), []);
  // The top strip is the drag area of the hidden title bar. The Chat / Terminal switch sits at its right.
  const [side, setSide] = useState<Side>("chat");
  const board = useBoard(NO_ISSUES);
  const workers = board?.orchestrating ?? 0;
  const [draft, setDraft] = useState<Draft>();
  const orchestrate = () => setDraft((d) => ({ text: ORCHESTRATE_COMMAND, id: (d?.id ?? 0) + 1 }));
  const tab = (s: Side, label: string) => (
    <button
      type="button"
      aria-pressed={side === s}
      onClick={() => setSide(s)}
      className={`rounded px-2.5 py-0.5 text-xs ${side === s ? "bg-selected text-foreground" : "text-muted hover:bg-hover"}`}
    >
      {label}
    </button>
  );
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-canvas">
      <div className="flex h-10 shrink-0 items-center justify-end px-3 [-webkit-app-region:drag]">
        <div role="group" aria-label="Chat or Terminal" className="flex gap-0.5 rounded-md border border-border bg-raised p-0.5 [-webkit-app-region:no-drag]">
          {tab("chat", "Chat")}
          {tab("terminal", "Terminal")}
        </div>
      </div>
      {side === "chat" ? (
        <>
          {feed.error && (
            <p role="alert" className="px-4 py-2 text-sm text-blocked">
              {feed.error.code}: {feed.error.message}
            </p>
          )}
          <ChatList rows={feed.rows} />
          <StatusLine
            working={feed.working}
            right={orchestratingText(workers)}
            onOrchestrate={board && showsOrchestrate(feed.agent, workers) ? orchestrate : undefined}
          />
          <ReplyBox title={title} draft={draft} />
        </>
      ) : (
        <TerminalView />
      )}
    </main>
  );
}
