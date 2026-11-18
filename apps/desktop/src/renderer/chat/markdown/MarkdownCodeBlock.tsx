// Copied in part from t3code apps/web/src/components/chat/MarkdownCodeBlock.tsx and
// MarkdownCodeBlock.logic.ts at the commit in THIRD_PARTY_NOTICES.md (MIT).
// Changes: no settings, wrap, run, diagram, Pierre icons, highlighting or
// streaming lines; a UI SDK tooltip on the copy button and the contr tokens.
import { Tip } from "../../ui/Tip";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { useCopy } from "./useCopy";

const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/;

export function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX);
  return match?.[1] ?? "text";
}

export function MarkdownCodeBlock({
  code,
  language,
  children,
}: {
  code: string;
  language: string;
  children: ReactNode;
}) {
  const { copy, copied } = useCopy();
  const copyLabel = copied ? "Copied" : "Copy code";
  // Only code that scrolls sideways needs a Tab stop.
  const pre = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = pre.current;
    if (!el) return;
    const update = () => {
      if (el.scrollWidth > el.clientWidth) el.tabIndex = 0;
      else el.removeAttribute("tabindex");
    };
    update();
    const size = new ResizeObserver(update);
    size.observe(el);
    return () => size.disconnect();
  }, [code]);
  return (
    <div
      dir="ltr"
      className="chat-markdown-codeblock my-[0.65rem] overflow-hidden rounded-[10px] border border-hairline leading-snug"
      data-language={language}
    >
      <div className="flex h-7 items-center justify-between gap-2 border-b border-hairline pr-1.5 pl-3 select-none">
        <span className="truncate font-mono text-[11px] text-dim">{language}</span>
        <Tip label={copyLabel} side="top">
          <button
            type="button"
            onClick={() => copy(code.endsWith("\n") ? code.slice(0, -1) : code)}
            aria-label={copyLabel}
            className="grid size-[22px] place-items-center rounded text-dim hover:bg-hover hover:text-foreground"
          >
            {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          </button>
        </Tip>
      </div>
      <pre ref={pre}>{children}</pre>
    </div>
  );
}
