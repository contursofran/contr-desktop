import { useEffect, useState } from "react";
import { Row } from "./chat/rows/Row";
import { StatusLine } from "./chat/rows/StatusLine";
import { ReplyBox } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";
import { TerminalView } from "./terminal/TerminalView";
import { Sidebar } from "./sidebar/Sidebar";
import type { Sidebar as SidebarData } from "../shared/api";

type Side = "chat" | "terminal";

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
          <ol aria-label="Chat" className="flex-1 overflow-y-auto px-4 pb-4">
            {feed.rows.map((row) => (
              <li key={row.id} data-kind={row.k} className="mx-auto w-full max-w-3xl py-1">
                <Row row={row} />
              </li>
            ))}
          </ol>
          <StatusLine working={feed.working} />
          <ReplyBox title={title} />
        </>
      ) : (
        <TerminalView />
      )}
    </main>
  );
}
