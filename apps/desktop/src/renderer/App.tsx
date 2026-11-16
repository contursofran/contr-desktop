import { useEffect, useState } from "react";
import { Row } from "./chat/rows/Row";
import { StatusLine } from "./chat/rows/StatusLine";
import { ReplyBox } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";

export function App() {
  const [feed, setFeed] = useState(emptyFeed);
  const [title, setTitle] = useState("");
  useEffect(() => void window.contr.title().then(setTitle), []);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), []);
  // The top strip is the drag area of the hidden title bar.
  return (
    <main className="flex h-screen flex-col bg-canvas text-foreground">
      <div className="h-10 shrink-0 [-webkit-app-region:drag]" />
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
    </main>
  );
}

