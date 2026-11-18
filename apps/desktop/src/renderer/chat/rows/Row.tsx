import { CheckIcon } from "lucide-react";
import type { FeedRow } from "../../../shared/api";
import { ChatMarkdown } from "../markdown/ChatMarkdown";
import { Spinner } from "./Spinner";
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
      return <ChatMarkdown text={row.text ?? ""} answer />;
    case "footer":
      return <p className="text-xs text-dim">{row.text}</p>;
    case "status":
      return <p className="text-center text-xs text-dim">{row.text}</p>;
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

/** The first line with text; " …" when more lines with text follow (herdr-contr `oneLine`). */
export function oneLine(text: unknown): string {
  const lines = String(text ?? "").split(/\r\n|\r|\n/).map((l) => l.replace(/\t/g, " ").trim());
  const i = lines.findIndex(Boolean);
  if (i < 0) return "";
  return lines.slice(i + 1).some(Boolean) ? `${lines[i]} …` : lines[i];
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
