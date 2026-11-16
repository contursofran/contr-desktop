import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "./chat/card/Card";
import { Row } from "./chat/rows/Row";
import { StatusLine } from "./chat/rows/StatusLine";
import { ReplyBox } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";
import { TerminalView } from "./terminal/TerminalView";

type Side = "chat" | "terminal";

export function App() {
  const [feed, setFeed] = useState(emptyFeed);
  const [title, setTitle] = useState("");
  useEffect(() => void window.contr.title().then(setTitle), []);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), []);
  const [side, setSide] = useState<Side>("chat");
  // The chat stays at its end while the owner has not scrolled up: when rows come in,
  // and when the list gets shorter because a card appears or grows.
  const list = useRef<HTMLOListElement>(null);
  const atEnd = useRef(true);
  const toEnd = () => {
    const el = list.current;
    if (el && atEnd.current) el.scrollTop = el.scrollHeight;
  };
  useLayoutEffect(toEnd, [feed.rows, feed.card, side]);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    // Rows can grow after they render (code, diagrams), so each row is watched too.
    const seen = new ResizeObserver(toEnd);
    const watch = () => {
      seen.disconnect();
      seen.observe(el);
      for (const row of Array.from(el.children)) seen.observe(row);
    };
    watch();
    const added = new MutationObserver(watch);
    added.observe(el, { childList: true });
    return () => {
      added.disconnect();
      seen.disconnect();
    };
  }, [side]);
  // The top strip is the drag area of the hidden title bar. The Chat / Terminal switch sits at its right.
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
    <main className="flex h-screen flex-col bg-canvas text-foreground">
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
          <ol
            ref={list}
            aria-label="Chat"
            onScroll={(e) => {
              const el = e.currentTarget;
              atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
            }}
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          >
            {feed.rows.map((row) => (
              <li key={row.id} data-kind={row.k} className="mx-auto w-full max-w-3xl py-1">
                <Row row={row} />
              </li>
            ))}
          </ol>
          {feed.card && <Card card={feed.card} />}
          <StatusLine working={feed.working} />
          <ReplyBox title={title} />
        </>
      ) : (
        <TerminalView />
      )}
    </main>
  );
}
