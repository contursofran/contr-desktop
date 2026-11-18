import { FileIcon } from "lucide-react";
import { ChipBox, NEUTRAL_OUTLINE } from "./ContextChip";

/** A file path (`e2e/keys.spec.ts:88`) with a file icon (rich-parts.html, Chips). The icon is ink, not a state color. */
export function FileChip({ path }: { path: string }) {
  return (
    <ChipBox className={`${NEUTRAL_OUTLINE} text-ink-100 [&_svg]:text-ink-62`} aria-label={`File ${path}`} data-file={path}>
      <FileIcon aria-hidden />
      {path}
    </ChipBox>
  );
}
