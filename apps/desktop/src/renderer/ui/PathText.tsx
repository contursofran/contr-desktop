import { CheckIcon, CopyIcon } from "lucide-react";
import { useCopy } from "../chat/markdown/useCopy";
import { Tip } from "./Tip";

/**
 * A file path in mono that truncates at its end, with a tooltip of the whole path and a Copy button.
 * The button is the code block's Copy (chat/markdown/MarkdownCodeBlock.tsx): `useCopy`, the same icons and look.
 */
export function PathText({ label, path }: { label: string; path: string }) {
  const { copy, copied } = useCopy();
  const copyLabel = copied ? "Copied" : "Copy path";
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Tip label={path}>
        <span aria-label={label} className="min-w-0 truncate font-mono text-[11px] text-muted">{path}</span>
      </Tip>
      {path && (
        <Tip label={copyLabel}>
          <button type="button" onClick={() => copy(path)} aria-label={copyLabel} className="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-foreground">
            {copied ? <CheckIcon aria-hidden className="size-3" /> : <CopyIcon aria-hidden className="size-3" />}
          </button>
        </Tip>
      )}
    </span>
  );
}
