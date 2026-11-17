// Copied in part from t3code apps/web/src/components/chat/MarkdownCodeBlock.tsx and
// MarkdownCodeBlock.logic.ts at the commit in THIRD_PARTY_NOTICES.md (MIT).
// Changes: no settings, wrap, run, diagram, Pierre icons, LRU cache or
// streaming lines; a UI SDK tooltip on the copy button and our theme tokens.
import { Tip } from "../../ui/Tip";
import { CheckIcon, CopyIcon } from "lucide-react";
import { use, type ReactNode } from "react";

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
  return (
    <div
      dir="ltr"
      className="chat-markdown-codeblock my-[0.65rem] overflow-hidden rounded-lg border border-border bg-raised leading-snug"
      data-language={language}
    >
      <div className="flex items-center justify-between gap-2 pt-1.5 pr-1.5 pb-0 pl-3 select-none">
        <span className="truncate font-mono text-xs text-muted">{language}</span>
        <Tip label={copyLabel} side="top">
          <button
            type="button"
            onClick={() => copy(code.endsWith("\n") ? code.slice(0, -1) : code)}
            aria-label={copyLabel}
            className="rounded p-1 text-muted hover:bg-hover hover:text-foreground"
          >
            {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          </button>
        </Tip>
      </div>
      {children}
    </div>
  );
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
