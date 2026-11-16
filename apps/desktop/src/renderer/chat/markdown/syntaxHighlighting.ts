// Copied from t3code apps/web/src/lib/syntaxHighlighting.ts and DIFF_THEME_NAMES from
// apps/web/src/lib/diffRendering.ts, at the commit in THIRD_PARTY_NOTICES.md (MIT).
// Changes: no client-runtime import, no custom extensions; pierre-light for light.
import {
  getSharedHighlighter,
  type DiffsHighlighter,
  type HighlighterTypes,
  type SupportedLanguages,
} from "@pierre/diffs";

export const DIFF_THEME_NAMES = {
  light: "pierre-light",
  dark: "pierre-dark",
} as const;

export type DiffThemeName = (typeof DIFF_THEME_NAMES)[keyof typeof DIFF_THEME_NAMES];

/**
 * Highlights' hand-written WASM lexers tokenize large files 10-40x faster than
 * Shiki and never backtrack like Shiki's JS regex engine. Only one highlighter
 * type can be active per thread, so every creation site must pass this value.
 */
export const PREFERRED_HIGHLIGHTER: HighlighterTypes = "highlights";

const highlighterPromiseCache = new Map<string, Promise<DiffsHighlighter>>();

export function getSyntaxHighlighterPromise(language: string): Promise<DiffsHighlighter> {
  const cached = highlighterPromiseCache.get(language);
  if (cached) return cached;

  const promise = getSharedHighlighter({
    // Both palettes, so switching appearance never needs a new highlighter.
    themes: Object.values(DIFF_THEME_NAMES),
    langs: [language as SupportedLanguages],
    preferredHighlighter: PREFERRED_HIGHLIGHTER,
  }).catch((error: unknown) => {
    if (language === "text") {
      highlighterPromiseCache.delete(language);
      throw error;
    }
    return getSyntaxHighlighterPromise("text");
  });
  highlighterPromiseCache.set(language, promise);
  return promise;
}
