// Copied in part from t3code apps/web/src/components/ContextChip.tsx at the commit in
// THIRD_PARTY_NOTICES.md (MIT). Changes: plain elements and one class string in place
// of base-ui's useRender and cva; only the inline shape and the label; no kinds (the
// caller gives the tone class); no action button; the redesign's shape (rich-parts.html,
// Chips: mono 12 px, 20 px high; the caller gives the color and the outline). Inline
// boxes, not flex and block: a copied selection then keeps `#12` on its line.
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

const CONTEXT_CHIP_CLASS =
  "whitespace-nowrap font-mono text-[12px] leading-4 py-0.5 ps-[5px] pe-[6px] rounded-md [&_svg]:inline-block [&_svg]:size-[13px] [&_svg]:me-[5px] [&_svg]:align-[-2px] [a&]:cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current";

/** The outline of a chip with no state color (rich-parts.html, `.chip`). */
export const NEUTRAL_OUTLINE = "shadow-[inset_0_0_0_1px_var(--hairline)]";

/** Ours: a chip is a button when it has an in-app target, or a span otherwise. */
export function ChipBox({ className, onActivate, ...props }: ComponentPropsWithoutRef<"span"> & { onActivate?: () => void }) {
  const classes = `${CONTEXT_CHIP_CLASS} align-baseline ${className ?? ""}`;
  if (onActivate) return <button type="button" className={`${classes} cursor-pointer`} data-slot="context-chip" {...props} onClick={onActivate} />;
  return <span className={classes} data-slot="context-chip" {...props} />;
}

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
