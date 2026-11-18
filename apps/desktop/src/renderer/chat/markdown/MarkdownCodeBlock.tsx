// Copied in part from t3code apps/web/src/components/chat/MarkdownCodeBlock.tsx and
// MarkdownCodeBlock.logic.ts at the commit in THIRD_PARTY_NOTICES.md (MIT).
// Changes: no settings, wrap, run, diagram, Pierre icons, LRU cache or
// streaming lines; a UI SDK tooltip on the copy button and the contr tokens.
import { Tip } from "../../ui/Tip";
import { CheckIcon, CopyIcon } from "lucide-react";
import { use, useEffect, useRef, type ReactNode } from "react";

import { useCopy } from "./useCopy";
import { DIFF_THEME_NAMES, getSyntaxHighlighterPromise } from "./syntaxHighlighting";

const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/;

export function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX);
  return highlighterLanguageOf(match?.[1] ?? "text");
}

export function highlighterLanguageOf(language: string): string {
  // Shiki doesn't bundle a gitignore grammar; ini is a close match.
  return language === "gitignore" ? "ini" : language;
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
  const ref = useRef<HTMLDivElement>(null);
  useScrollTabStop(ref);
  return (
    <div
      ref={ref}
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
      {children}
    </div>
  );
}

/** A code block is a Tab stop only when it scrolls sideways: the keys then scroll it. Else Tab goes past it. */
export function setScrollTabStop(pre: HTMLElement) {
  if (pre.scrollWidth > pre.clientWidth) pre.tabIndex = 0;
  else pre.removeAttribute("tabindex");
}

/** Keeps `setScrollTabStop` true for the `pre` in the block when its width or its code changes. */
function useScrollTabStop(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => el.querySelectorAll("pre").forEach(setScrollTabStop);
    update();
    const size = new ResizeObserver(update);
    size.observe(el);
    // The highlighted code replaces the plain fallback after it loads.
    const swap = new MutationObserver(update);
    swap.observe(el, { childList: true, subtree: true });
    return () => {
      size.disconnect();
      swap.disconnect();
    };
  }, [ref]);
}

export function HighlightedCode({
  code,
  language,
  theme,
}: {
  code: string;
  language: string;
  theme: "light" | "dark";
}) {
  const highlighter = use(getSyntaxHighlighterPromise(language));
  const themeName = DIFF_THEME_NAMES[theme];
  let html: string;
  try {
    html = highlighter.codeToHtml(code, { lang: language, theme: themeName });
  } catch (error) {
    console.warn(
      `Code highlighting failed for language "${language}", falling back to plain text.`,
      error instanceof Error ? error.message : error,
    );
    html = highlighter.codeToHtml(code, { lang: "text", theme: themeName });
  }
  return <div className="chat-markdown-shiki" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A `diff` or `patch` fence colors its lines (docs/design/chat-blocks.md, Code). */
export function isDiffLanguage(language: string): boolean {
  return language === "diff" || language === "patch";
}

export type DiffLineKind = "add" | "del" | "meta" | "context";

/** File headers and `@@` hunk lines are "meta"; then `+` adds and `-` removes. */
export function diffLineKind(line: string): DiffLineKind {
  if (/^(?:@@|\+\+\+ |--- |diff |index )/.test(line)) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}

/** The diff as plain text, one span per line with its kind: no syntax colors. */
export function DiffCode({ code }: { code: string }) {
  const lines = (code.endsWith("\n") ? code.slice(0, -1) : code).split("\n");
  return (
    <div className="chat-markdown-shiki">
      <pre className="chat-diff">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="line" data-diff={diffLineKind(line)}>
              {line}
              {i < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
