import { Plus } from "lucide-react";
import { Tip } from "../../ui/Tip";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Attachments } from "./Attachments";
import { addImage, readDraft, removeImage, saveDraft } from "./drafts";
import { composeMessage, isSendKey } from "./message";
import { serial } from "./menu";
import { Branch, ContextRing, ModelButton, useReplyInfo } from "./ReplyFoot";

/** A text to put in the box. A new `id` puts it again. */
export interface Draft {
  text: string;
  id: number;
}

/**
 * The reply box (docs/design/README.md, part 6): Enter sends, Shift+Enter is a new line, ⌘V attaches an image.
 * A `draft` replaces the text, puts the caret at its end and focuses the box; it does not send.
 * Each attached file has a × that removes it (`Attachments.tsx`).
 * The unsent text and images of each `terminal` stay in memory (`drafts.ts`) when another view shows.
 */
export function ReplyBox({ terminal, title, draft }: { terminal: string; title: string; draft?: Draft }) {
  const [text, setText] = useState(() => readDraft(terminal).text);
  const box = useRef<HTMLTextAreaElement>(null);
  useGrow(box, text);
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    const el = box.current;
    if (!el) return;
    el.value = draft.text;
    el.focus();
    el.setSelectionRange(draft.text.length, draft.text.length);
  }, [draft]);
  const [images, setImages] = useState<string[]>(() => readDraft(terminal).images);
  useEffect(() => saveDraft(terminal, { text, images }), [terminal, text, images]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const message = composeMessage(text, images);
  const { info, branch } = useReplyInfo();
  // Messages and menu commands go one after the other: a menu choice made during a send is not lost.
  const queue = useRef(serial()).current;
  const sendText = (body: string) =>
    queue(() => window.contr.send(body)).catch((e: unknown) => ({ ok: false, message: String(e) }));

  async function sendCommand(command: string): Promise<boolean> {
    const result = await sendText(command);
    if (!result.ok) setError(result.message ?? "send failed");
    return result.ok;
  }

  async function send() {
    if (message === "" || sending) return;
    setSending(true);
    setError(null);
    const result = await sendText(message);
    setSending(false);
    if (!result.ok) return setError(result.message ?? "send failed");
    // The chat can be gone by now: clear the stored draft too.
    saveDraft(terminal, { text: "", images: [] });
    setText("");
    setImages([]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isSendKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) return;
    event.preventDefault();
    void send();
  }

  // The file goes to this terminal's stored draft too: if another agent shows before the pick ends, it stays here.
  function attach(path: string) {
    const next = addImage(readDraft(terminal), path);
    saveDraft(terminal, next);
    setImages(next.images);
  }

  function detach(index: number) {
    const next = removeImage(readDraft(terminal), index);
    saveDraft(terminal, next);
    setImages(next.images);
    // The removed × had the focus: give it to the text box.
    box.current?.focus();
  }

  async function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    // Only an image goes to the helper; plain text pastes as the DOM does it.
    if (!Array.from(event.clipboardData.items).some((item) => item.type.startsWith("image/"))) return;
    event.preventDefault();
    const result = await window.contr.pasteImage();
    if (!result.ok) return setError(result.message ?? "paste failed");
    if (result.path) attach(result.path);
  }

  async function onAttach() {
    // A picked file takes the same path as a pasted image.
    const result = await window.contr.pickImage().catch((e: unknown) => ({ ok: false, path: null, message: String(e) }));
    if (!result.ok) return setError(result.message ?? "attach failed");
    if (result.path) attach(result.path);
  }

  return (
    <form
      aria-label="Reply"
      className="mx-auto mb-4 w-full max-w-read rounded-lg border border-border bg-raised p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <Attachments images={images} onRemove={detach} />
      <textarea
        ref={box}
        aria-label={`Reply to ${title}`}
        placeholder={`Reply to ${title}`}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => void onPaste(event)}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-dim"
      />
      {error && (
        <p role="alert" className="mb-1 text-xs text-blocked">
          Not sent: {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Tip label="Attach image" side="top">
          <button type="button" aria-label="Attach image" onClick={() => void onAttach()} className="rounded-full p-1 text-muted hover:bg-hover hover:text-foreground">
            <Plus aria-hidden className="size-4" />
          </button>
        </Tip>
        <ModelButton info={info} send={sendCommand} />
        <span className="flex-1" />
        <ContextRing context={info.context} />
        <Branch branch={branch} />
        <button
          type="submit"
          aria-label="Send"
          disabled={message === "" || sending}
          className="rounded-full bg-foreground px-3 py-0.5 text-sm text-canvas disabled:bg-hover disabled:text-faint"
        >
          ↑
        </button>
      </div>
    </form>
  );
}

/** The box's largest height, as a part of the window's height. Over it, the text scrolls inside the box. */
export const GROW_LIMIT = 0.4;

/** The box grows with its text from its `rows` height up to `GROW_LIMIT` of the window, and shrinks when the text gets shorter. */
function useGrow(box: { current: HTMLTextAreaElement | null }, text: string) {
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    const limit = Math.floor(windowHeight * GROW_LIMIT);
    el.style.height = `${Math.min(el.scrollHeight, limit)}px`;
    el.style.overflowY = el.scrollHeight > limit ? "auto" : "hidden";
  }, [box, text, windowHeight]);
}
