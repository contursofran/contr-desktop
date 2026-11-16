import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { composeMessage, isSendKey } from "./message";

/** The reply box (docs/design/README.md, part 6): Enter sends, Shift+Enter is a new line, ⌘V attaches an image. */
export function ReplyBox({ title }: { title: string }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const message = composeMessage(text, images);

  async function send() {
    if (message === "" || sending) return;
    setSending(true);
    setError(null);
    const result = await window.contr.send(message).catch((e: unknown) => ({ ok: false, message: String(e) }));
    setSending(false);
    if (!result.ok) return setError(result.message ?? "send failed");
    setText("");
    setImages([]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isSendKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) return;
    event.preventDefault();
    void send();
  }

  async function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    // Only an image goes to the helper; plain text pastes as the DOM does it.
    if (!Array.from(event.clipboardData.items).some((item) => item.type.startsWith("image/"))) return;
    event.preventDefault();
    const result = await window.contr.pasteImage();
    if (!result.ok) return setError(result.message ?? "paste failed");
    if (result.path) setImages((list) => [...list, result.path as string]);
  }

  return (
    <form
      aria-label="Reply"
      className="mx-4 mb-4 rounded-lg border border-border bg-raised p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {images.length > 0 && (
        <ul aria-label="Attachments" className="mb-1 flex flex-wrap gap-1">
          {images.map((image) => (
            <li key={image} className="rounded bg-selected px-2 py-0.5 text-xs text-muted">
              {image.split("/").pop()}
            </li>
          ))}
        </ul>
      )}
      <textarea
        aria-label={`Reply to ${title}`}
        placeholder={`Reply to ${title}`}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => void onPaste(event)}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-dim"
      />
      <div className="flex items-center justify-between">
        {error ? (
          <p role="alert" className="text-xs text-blocked">
            Not sent: {error}
          </p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          aria-label="Send"
          disabled={message === "" || sending}
          className="rounded-full bg-foreground px-3 py-0.5 text-sm text-canvas disabled:bg-hover disabled:text-dim"
        >
          ↑
        </button>
      </div>
    </form>
  );
}
