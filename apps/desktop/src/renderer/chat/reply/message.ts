/** The text that the reply box sends: the typed text, then each pasted image path on its own line. */
export function composeMessage(text: string, images: string[]): string {
  return [text.trim(), ...images].filter((part) => part !== "").join("\n");
}

/** Enter sends; Shift+Enter, and Enter while an input method composes, make a new line. */
export function isSendKey(event: { key: string; shiftKey: boolean; isComposing?: boolean }): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}
