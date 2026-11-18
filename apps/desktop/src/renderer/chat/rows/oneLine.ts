/** The first line with text; " …" when more lines with text follow (herdr-contr `oneLine`). */
export function oneLine(text: unknown): string {
  const lines = String(text ?? "").split(/\r\n|\r|\n/).map((l) => l.replace(/\t/g, " ").trim());
  const i = lines.findIndex(Boolean);
  if (i < 0) return "";
  return lines.slice(i + 1).some(Boolean) ? `${lines[i]} …` : lines[i];
}
