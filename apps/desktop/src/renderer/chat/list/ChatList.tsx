import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { useEffect, useRef } from "react";
import type { FeedRow } from "../../../shared/api";
import { Row } from "../rows/Row";

// The chat rows in a virtual list (Legend List, as t3code's MessagesTimeline).
// Only the rows near the viewport are in the DOM. The list follows new rows
// and height changes while it is at the end, and stays put when the owner
// scrolled up. Size anchoring keeps the rows on screen still when a row above
// changes height (Markdown, tables, open tool chips).
export function ChatList({ rows }: { rows: FeedRow[] }) {
  const list = useRef<LegendListRef>(null);
  const box = useRef<HTMLDivElement>(null);
  // At the end until the owner scrolls up. Read on scroll, before a resize changes it.
  const atEnd = useRef(true);

  // Legend skips its own follow on a resize that comes before its first scroll
  // to the end is done (a card that opens under the list on a slow machine).
  // So the list goes to its end again on each height change while it was there.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (atEnd.current) void list.current?.scrollToEnd({ animated: false });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col">
      <LegendList
        ref={list}
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
        onScroll={() => {
          const state = list.current?.getState();
          if (state) atEnd.current = state.isFollowingEnd || state.isWithinMaintainScrollAtEndThreshold;
        }}
        renderItem={({ item }) => (
          <div role="listitem" data-kind={item.k} data-row-id={item.id} className="mx-auto w-full max-w-3xl py-1">
            <Row row={item} />
          </div>
        )}
      />
    </div>
  );
}
