import { useEffect, useState } from "react";
import { ReplyBox } from "./chat/reply/ReplyBox";
import { applyFeed, emptyFeed } from "./feed/apply";

export function App() {
  const [feed, setFeed] = useState(emptyFeed);
  useEffect(() => window.contr.onFeed((event) => setFeed((state) => applyFeed(state, event))), []);
  // The top strip is the drag area of the hidden title bar. Rows show as plain text for now.
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
          <li key={row.id} data-kind={row.k} className="whitespace-pre-wrap py-1 text-sm">
            <span className="text-dim">{row.k}: </span>
            {rowText(row)}
          </li>
        ))}
      </ol>
      <ReplyBox title={feed.agent ?? "agent"} />
    </main>
  );
}

function rowText(row: import("../shared/api").FeedRow): string {
  if (row.k === "tools") return (row.chips ?? []).map((c) => c.text).join(", ");
  return row.text ?? "";
}
