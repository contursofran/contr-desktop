import { CheckIcon } from "lucide-react";
import type { FeedRow } from "../../../shared/api";
import { ChatMarkdown } from "../markdown/ChatMarkdown";
import { Spinner } from "./Spinner";
import { ToolsRow } from "./ToolsRow";
import { oneLine } from "./oneLine";

export { oneLine };
import { UserRow } from "./UserRow";

/** One chat row by its kind (docs/reference/helper-protocol.md, `row`). */
export function Row({ row }: { row: FeedRow }) {
  switch (row.k) {
    case "user":
      return <UserRow row={row} />;
    case "tools":
      return <ToolsRow row={row} />;
    case "sep":
      return (
        <div className="flex items-center gap-2.5 text-xs text-dim">
          <span className="h-px flex-1 bg-hairline" />{row.text}<span className="h-px flex-1 bg-hairline" />
        </div>
      );
    case "assistant":
      return <ChatMarkdown text={row.text ?? ""} answer rowId={row.id} />;
    case "footer":
      // The helper's text: the answer's time, how long it worked, the tool count ("19:24 · Worked 1m 18s · 8 tools").
      return <p className="font-mono text-[11px] text-dim">{row.text}</p>;
    case "status":
      // A thin centered line, as "Context compacted".
      return (
        <div className="flex items-center gap-2.5 text-xs text-dim">
          <span className="h-px flex-1 bg-hairline" />{row.text}<span className="h-px flex-1 bg-hairline" />
        </div>
      );
    case "perm":
      return <PermRow row={row} />;
    case "question": {
      const pending = (row.question as { state?: string } | undefined)?.state === "pending";
      return (
        <div className="flex h-11 items-center">
          <span className="truncate rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] text-muted">
            {pending ? "The agent asks a question" : "Question answered"}
          </span>
        </div>
      );
    }
    default:
      // A kind this app does not know: an empty line, as herdr-contr draws it.
      return <div className="h-[30px]" data-kind={row.k} />;
  }
}

/** A tool call with no result yet, as a chip. Whether it waits for an approval is the card's job. */
function PermRow({ row }: { row: FeedRow }) {
  const perm = row.perm as { title?: string; tool?: string; state?: string } | undefined;
  const what = oneLine(row.text || perm?.title || perm?.tool) || "a tool";
  const pending = perm?.state === "pending";
  return (
    <div className="flex h-11 items-center">
      <span className="flex h-7 max-w-[80%] items-center gap-1.5 rounded-full border border-border bg-chrome px-3 text-sm text-muted">
        {pending ? <Spinner size={11} className="text-working" /> : <CheckIcon aria-label="done" className="size-3 shrink-0 text-done" />}
        <span className="truncate">{pending ? `Running · ${what}` : what}</span>
      </span>
    </div>
  );
}
