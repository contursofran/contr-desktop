import type { CheckCounts } from "../../../shared/api";
import { StatusGlyph } from "../../ui/StatusGlyph";

/** The label of the checks for screen readers. */
export function checksLabel(c: CheckCounts): string {
  if (c.state === "fail") return `${c.failed} of ${c.total} checks failed`;
  if (c.state === "pending") return `checks running, ${c.passed} of ${c.total} passed`;
  return `${c.passed} of ${c.total} checks passed`;
}

/**
 * The checks after a PR's number (rich-parts.html, Chips): ✓ 6/6, the working glyph and 4/6, or ✕ 1 in ink.
 * Not selectable, so a copied selection keeps only `#12`. The chip's label says the checks.
 */
export function ChecksMark({ checks }: { checks: CheckCounts }) {
  const base = "ms-[5px] select-none text-[11px]";
  if (checks.state === "fail") return <span aria-hidden data-checks="fail" className={`${base} text-ink-100`}>✕ {checks.failed}</span>;
  return (
    <span aria-hidden data-checks={checks.state} className={`${base} text-ink-45`}>
      {checks.state === "pending" ? <StatusGlyph state="working" className="w-auto! text-[11px]! leading-none!" /> : "✓"} {checks.passed}/{checks.total}
    </span>
  );
}
