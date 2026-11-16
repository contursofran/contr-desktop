// Parse for `contr-seq` blocks (docs/design/chat-blocks.md).
// A block past a limit, or one that does not parse, gives null: it shows as code.

export const SEQ_LIMITS = { actors: 6, messages: 16, name: 28, text: 40 } as const;

export interface SeqMessage { from: string; to: string; text: string; reply: boolean }
export interface Seq { actors: string[]; messages: SeqMessage[] }

// A name has no `:` and no arrow; the text is required.
const NAME = String.raw`(?:(?!-->|->)[^:])+?`;
const MESSAGE = new RegExp(String.raw`^(${NAME})\s*(-->|->)\s*(${NAME})\s*:\s*(.*\S)$`);

export function parseSeq(source: string): Seq | null {
  const actors: string[] = [];
  const messages: SeqMessage[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(MESSAGE);
    if (!m) return null;
    const [, from, arrow, to, text] = m;
    if (from.length > SEQ_LIMITS.name || to.length > SEQ_LIMITS.name || text.length > SEQ_LIMITS.text) return null;
    for (const a of [from, to]) if (!actors.includes(a)) actors.push(a);
    messages.push({ from, to, text, reply: arrow === "-->" });
  }
  if (!messages.length || actors.length > SEQ_LIMITS.actors || messages.length > SEQ_LIMITS.messages) return null;
  return { actors, messages };
}
