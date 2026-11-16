// Copied in part from t3code apps/web/src/components/chat/MarkdownTable.tsx at the
// commit in THIRD_PARTY_NOTICES.md (MIT). Changes: a plain scroll div; no copy menu.
import type { ComponentProps } from "react";

export function MarkdownTable({ children, ...props }: ComponentProps<"table">) {
  return (
    <div className="chat-markdown-table-container">
      <div className="w-full max-w-full overflow-x-auto">
        <table {...props}>{children}</table>
      </div>
    </div>
  );
}
