// Copied in part from t3code apps/web/src/components/ContextChip.tsx at the commit in
// THIRD_PARTY_NOTICES.md (MIT). Changes: plain elements and one class string in place
// of base-ui's useRender and cva; only the inline shape and the label; no kinds (the
// caller gives the tone class); no action button. Inline boxes, not flex and block:
// a copied selection then keeps `#12` on its line.
import type { ComponentProps } from "react";

const CONTEXT_CHIP_CLASS =
  "whitespace-nowrap font-medium [&_svg]:inline-block [&_svg]:size-[1em] [&_svg]:me-[0.2em] [&_svg]:align-[-0.15em] [a&]:cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current rounded-sm";

export function ContextChip({ className, ...props }: ComponentProps<"a">) {
  return <a className={`${CONTEXT_CHIP_CLASS} ${className ?? ""}`} data-slot="context-chip" {...props} />;
}

export function ContextChipLabel({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={`underline decoration-transparent decoration-1 underline-offset-[0.2em] transition-colors motion-reduce:transition-none [a:hover>&]:decoration-current ${className ?? ""}`}
      data-slot="context-chip-label"
      {...props}
    />
  );
}
