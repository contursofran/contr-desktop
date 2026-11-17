/** What the reply box holds and has not sent yet: the text and the attached images. */
export interface Unsent {
  text: string;
  images: string[];
}

const EMPTY: Unsent = { text: "", images: [] };

/**
 * The unsent reply of each agent, by its terminal. It is in memory only (a restart forgets it):
 * the chat mounts again on each switch, so the box reads its draft here and writes each change back.
 */
const drafts = new Map<string, Unsent>();

export function readDraft(terminal: string): Unsent {
  return drafts.get(terminal) ?? EMPTY;
}

/** An empty draft is dropped. */
export function saveDraft(terminal: string, draft: Unsent): void {
  if (draft.text === "" && draft.images.length === 0) drafts.delete(terminal);
  else drafts.set(terminal, draft);
}
