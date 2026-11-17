import { LegendList, type LegendListRef } from "@legendapp/list/react";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeedRow } from "../../../shared/api";
import { Row } from "../rows/Row";
import { Spinner } from "../rows/Spinner";

/** The chat before the helper's first answer (issue #141): the braille loader and a short muted text, not a blank area. */
export function ChatLoading() {
  return (
    <div role="status" aria-label="Reading the chat" className="absolute inset-0 flex items-center justify-center gap-2 px-8 text-[12.5px] text-muted">
      <Spinner size={13} />
      Reading the chat…
    </div>
  );
}

// The chat rows in a virtual list (Legend List, as t3code's MessagesTimeline).
// Only the rows near the viewport are in the DOM. The list follows new rows
// and height changes while it is at the end, and stays put when the owner
// scrolled up. Size anchoring keeps the rows on screen still when a row above
// changes height (Markdown, tables, open tool chips).
// While the owner reads older rows, a round ↓ button (as herdr-contr's chat) goes back to the end. Its arrow
// takes the accent color when a new row came in after the owner scrolled up.
export function ChatList({ rows }: { rows: FeedRow[] }) {
  const list = useRef<LegendListRef>(null);
  const box = useRef<HTMLDivElement>(null);
  // At the end until the owner scrolls up. Read on scroll, before a resize changes it.
  const atEnd = useRef(true);
  // The same as `atEnd`, for the ↓ button. `fresh`: a new last row came in while not at the end.
  const [following, setFollowing] = useState(true);
  const [fresh, setFresh] = useState(false);
  const last = rows.at(-1)?.id;
  const seen = useRef(last);
  // Older rows that load at the top do not change the last row, so they do not mark the button.
  useEffect(() => {
    if (last === seen.current) return;
    seen.current = last;
    if (!atEnd.current) setFresh(true);
  }, [last]);

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
    <div ref={box} className="relative flex min-h-0 flex-1 flex-col">
      {/* Before the rows in the DOM, so Tab reaches it right after the reply box (App renders that first) and
          before the rows' controls. It shows only away from the end, so it never covers the last row there. */}
      {!following && (
        <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-10 flex justify-center">
          <button
            type="button"
            aria-label="Jump to the end"
            aria-description={fresh ? "New messages" : undefined}
            data-fresh={fresh || undefined}
            onClick={() => void list.current?.scrollToEnd({ animated: true })}
            className={`pointer-events-auto flex size-[34px] items-center justify-center rounded-full border border-border bg-raised shadow-sm hover:bg-hover ${fresh ? "text-accent" : "text-foreground"}`}
          >
            <ArrowDown size={15} aria-hidden />
          </button>
        </div>
      )}
      <LegendList
        ref={list}
        aria-label="Chat"
        role="list"
        // A classic scrollbar takes width on the right. The same gutter on the left keeps the rows centered
        // on the box, as the status line, the reply box and the ↓ button are, with both scrollbar kinds.
        className="flex-1 px-4 [scrollbar-gutter:stable_both-edges]"
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
          if (!state) return;
          atEnd.current =
            state.isFollowingEnd || state.isWithinMaintainScrollAtEndThreshold;
          setFollowing(atEnd.current);
          if (atEnd.current) setFresh(false);
        }}
        renderItem={({ item }) => (
          <div
            role="listitem"
            data-kind={item.k}
            data-row-id={item.id}
            className="mx-auto w-full max-w-read py-1"
          >
            <Row row={item} />
          </div>
        )}
      />
    </div>
  );
}
