import { CheckIcon, CopyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCopy } from "../chat/markdown/useCopy";
import { Tip } from "../ui/Tip";

/** The parts of Settings as rows (redesign, #187): a group head, rows with hairlines, a value in mono, a button. */

/** A button of Settings: the design system's `.btn`; `primary` is `.btn.is-primary`. */
export function buttonClass(primary = false): string {
  const fill = primary ? "bg-selected text-ink-100" : "text-ink-90 hover:bg-hover";
  return `inline-flex h-7 shrink-0 items-center rounded-lg px-3 text-[12.5px] whitespace-nowrap shadow-[inset_0_0_0_1px_var(--color-input-line)] disabled:opacity-50 ${fill}`;
}

/** One group: its head (the title, then `aside` on the right) and its rows between hairlines. */
export function Group({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-1 pt-5 pb-2">
        <h2 className="grow text-xs font-medium text-dim">{title}</h2>
        {aside}
      </div>
      <div className="border-t border-hairline">{children}</div>
    </>
  );
}

/** One row: the label on the left, then the rest on the right. */
export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center gap-3 border-b border-hairline px-1 py-1.5 text-[13px] text-ink-85">
      {label && <span className="mr-auto shrink-0">{label}</span>}
      {children}
    </div>
  );
}

/** The value of a row, in mono. */
export function Value({ label, children }: { label?: string; children: ReactNode }) {
  return <span aria-label={label} className="min-w-0 max-w-[420px] truncate font-mono text-[11.5px] text-muted">{children}</span>;
}

/**
 * A path as the value of a row: cut from the left ("…/e2e/fake-helper.mjs"), so the file name shows and the home
 * folder does not. The whole path is in the tooltip and in the text; Copy is the code block's Copy (`useCopy`).
 */
export function PathValue({ label, path }: { label: string; path: string }) {
  const { copy, copied } = useCopy();
  const copyLabel = copied ? "Copied" : "Copy path";
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Tip label={path}>
        <span aria-label={label} dir="rtl" className="min-w-0 max-w-[420px] truncate font-mono text-[11.5px] text-muted">
          <bdi dir="ltr">{path}</bdi>
        </span>
      </Tip>
      {path && (
        <Tip label={copyLabel}>
          <button type="button" onClick={() => copy(path)} aria-label={copyLabel} className="grid size-[22px] shrink-0 items-center justify-items-end rounded-lg text-dim hover:bg-hover hover:text-foreground">
            {copied ? <CheckIcon aria-hidden className="size-3.5" /> : <CopyIcon aria-hidden className="size-3.5" />}
          </button>
        </Tip>
      )}
    </span>
  );
}
