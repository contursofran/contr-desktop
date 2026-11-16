import { LegendList } from "@legendapp/list/react";
import type { FeedRow } from "../../../shared/api";
import { Row } from "../rows/Row";

// The chat rows in a virtual list (Legend List, as t3code's MessagesTimeline).
// Only the rows near the viewport are in the DOM. The list follows new rows
// and height changes while it is at the end, and stays put when the owner
// scrolled up. Size anchoring keeps the rows on screen still when a row above
// changes height (Markdown, tables, open tool chips).
export function ChatList({ rows }: { rows: FeedRow[] }) {
  return (
    <LegendList
      aria-label="Chat"
      role="list"
      className="flex-1 px-4"
      data={rows}
      keyExtractor={(row) => row.id}
      ListFooterComponent={<div className="h-4" />}
      estimatedItemSize={80}
      recycleItems={false}
      initialScrollAtEnd
      maintainScrollAtEnd
      maintainScrollAtEndThreshold={0.1}
      maintainVisibleContentPosition
      renderItem={({ item }) => (
        <div role="listitem" data-kind={item.k} data-row-id={item.id} className="mx-auto w-full max-w-3xl py-1">
          <Row row={item} />
        </div>
      )}
    />
  );
}
