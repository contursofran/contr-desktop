import type { FeedEvent, FeedRow } from "../../shared/api";
import { runHelper, type HelperLine } from "./run";

/** `feed` is one call per command, so we call it again on a timer. The helper has no watch mode yet. */
export const FEED_INTERVAL_MS = 1000;

/** Turns one `feed` answer into a FeedEvent, or null for `unchanged`. Returns the new cursor too. */
export function readFeedAnswer(lines: HelperLine[]): { event: FeedEvent | null; cursor?: string } {
  const error = lines.find((l) => l.type === "error");
  if (error) return { event: { type: "error", code: String(error.code), message: String(error.message) } };
  const log = lines.find((l) => l.type === "log");
  const cursor = typeof log?.cursor === "string" ? log.cursor : undefined;
  const splice = lines.find((l) => l.type === "splice");
  if (!splice) return { event: null, cursor };
  const rows = lines.filter((l) => l.type === "row").map((line) => { const row = { ...line } as Partial<HelperLine>; delete row.type; return row as unknown as FeedRow; });
  return {
    cursor,
    event: {
      type: "splice",
      at: Number(splice.at),
      rows,
      agent: typeof log?.agent === "string" ? log.agent : undefined,
      model: typeof log?.model === "string" ? log.model : undefined,
    },
  };
}

/** Calls `feed` for one terminal until stopped. After an error it starts again without a cursor. */
export function startFeed(helper: string, terminal: string, emit: (event: FeedEvent) => void): () => void {
  let cursor: string | undefined;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    const args = ["feed", "--terminal", terminal, ...(cursor ? ["--cursor", cursor] : [])];
    const answer = readFeedAnswer(await runHelper(helper, args));
    if (stopped) return;
    if (answer.event?.type === "error") cursor = undefined;
    else cursor = answer.cursor ?? cursor;
    if (answer.event) emit(answer.event);
    timer = setTimeout(() => void tick(), FEED_INTERVAL_MS);
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** Types a message into the terminal with the helper's `send` command. */
export async function sendText(helper: string, terminal: string, text: string): Promise<{ ok: boolean; message?: string }> {
  const lines = await runHelper(helper, ["send", "--terminal", terminal, "--text", text]);
  const error = lines.find((l) => l.type === "error");
  if (error) return { ok: false, message: String(error.message) };
  const changed = lines.find((l) => l.type === "changed");
  if (changed) return { ok: false, message: String(changed.message ?? "the terminal changed") };
  return { ok: true };
}

/** Saves the clipboard's image as a PNG in `dir` with the helper's `paste-image` command. */
export async function pasteImage(helper: string, dir: string): Promise<{ ok: boolean; path?: string | null; message?: string }> {
  const lines = await runHelper(helper, ["paste-image", "--dir", dir]);
  const error = lines.find((l) => l.type === "error");
  if (error) return { ok: false, message: String(error.message) };
  const image = lines.find((l) => l.type === "image");
  return { ok: true, path: typeof image?.path === "string" ? image.path : null };
}
