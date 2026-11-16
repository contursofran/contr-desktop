import type { FeedRow } from "../../../shared/api";
import { ChatMarkdown } from "../markdown/ChatMarkdown";
import { ToolsRow } from "./ToolsRow";
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
        <div className="flex items-center gap-3 text-xs text-dim">
          <span className="h-px flex-1 bg-border" />{row.text}<span className="h-px flex-1 bg-border" />
        </div>
      );
    case "assistant":
      return <ChatMarkdown text={row.text ?? ""} />;
    case "footer":
      return <p className="text-xs text-dim">{row.text}</p>;
    case "status":
      return <p className="text-center text-xs text-dim">{row.text}</p>;
    default:
      return <p className="whitespace-pre-wrap text-sm">{row.text ?? ""}</p>;
  }
}
