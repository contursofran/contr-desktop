import type { Unsent } from "./drafts";
import { composeMessage } from "./message";

export interface SendResult {
  ok: boolean;
  message?: string;
  /** True when the message did not go because a message before it failed. */
  skipped?: boolean;
}

const cutText = (box: string, part: string) => (box.startsWith(part) ? box.slice(part.length) : box);
const cutImages = (box: string[], part: string[]) => (part.every((p, i) => box[i] === p) ? box.slice(part.length) : box);

/** `box` without `part` at its start. A field that does not start with the part (the owner changed it) stays whole. */
export function cutSent(box: Unsent, part: Unsent): Unsent {
  return { text: cutText(box.text, part.text), images: cutImages(box.images, part.images) };
}

/**
 * The messages on their way to the agent (issue #141). Each message is the part of the box after the parts that
 * the messages before it took, so Enter during a send queues only the new text and images.
 * `queue` runs the sends one after the other (`serial`). After a failed send, the messages queued behind it do not
 * go: they stay in the box, in order, with the failed one.
 */
export function outbox(queue: <T>(task: () => Promise<T>) => Promise<T>, send: (body: string) => Promise<SendResult>) {
  let taken: Unsent[] = [];
  const untaken = (box: Unsent) => taken.reduce(cutSent, box);
  return {
    untaken,
    /** Queues the untaken part of `box`. Null when that part has no text and no image. */
    take(box: Unsent): { part: Unsent; done: Promise<SendResult> } | null {
      const part = untaken(box);
      const body = composeMessage(part.text, part.images);
      if (body === "") return null;
      taken = [...taken, part];
      const done = queue(async (): Promise<SendResult> => {
        if (!taken.includes(part)) return { ok: false, skipped: true };
        const result = await send(body).catch((e: unknown) => ({ ok: false, message: String(e) }));
        taken = result.ok ? taken.filter((p) => p !== part) : [];
        return result;
      });
      return { part, done };
    },
  };
}
