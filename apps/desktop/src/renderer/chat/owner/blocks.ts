/** One part of a to-do's text: a paragraph with the code spans that did not show before, or a fenced code block. */
export type TodoBlock = { kind: "text"; text: string; spans: string[] } | { kind: "code"; code: string };

/** Splits a to-do's Markdown into paragraphs and fenced code blocks, for the copy rows (docs/design/recipe-herdr.md, Owner to-do card). */
export function splitTodo(markdown: string): TodoBlock[] {
  const out: TodoBlock[] = [];
  const seen = new Set<string>();
  const paragraphs = (text: string) => {
    for (const p of text.split(/\n\s*\n/)) {
      if (!p.trim()) continue;
      const spans: string[] = [];
      for (const m of p.matchAll(/`([^`\n]+)`/g)) {
        if (seen.has(m[1]!)) continue;
        seen.add(m[1]!);
        spans.push(m[1]!);
      }
      out.push({ kind: "text", text: p.trim(), spans });
    }
  };
  const fence = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let at = 0;
  for (const m of markdown.matchAll(fence)) {
    paragraphs(markdown.slice(at, m.index));
    out.push({ kind: "code", code: m[1]!.replace(/\n$/, "") });
    at = m.index! + m[0].length;
  }
  paragraphs(markdown.slice(at));
  return out;
}

/** The number of copy rows of a to-do: its new code spans and its code blocks ("3 commands" on the chat's row). */
export const todoCommands = (blocks: TodoBlock[]): number => blocks.reduce((n, b) => n + (b.kind === "code" ? 1 : b.spans.length), 0);
