import { Plus } from "lucide-react";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { composeMessage, isSendKey } from "./message";
import { serial } from "./menu";
import { Branch, ContextRing, ModelButton, useReplyInfo } from "./ReplyFoot";

/** The reply box (docs/design/README.md, part 6): Enter sends, Shift+Enter is a new line, ⌘V or the + button attaches an image. */
export function ReplyBox({ title }: { title: string }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
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

  async function onAttach() {
    // A picked file takes the same path as a pasted image.
    const result = await window.contr.pickImage().catch((e: unknown) => ({ ok: false, path: null, message: String(e) }));
    if (!result.ok) return setError(result.message ?? "attach failed");
    if (result.path) setImages((list) => [...list, result.path as string]);
  }

  return (
    <form
      aria-label="Reply"
      className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-border bg-raised p-2"
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
      {error && (
        <p role="alert" className="mb-1 text-xs text-blocked">
          Not sent: {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Attach image"
          title="Attach image"
          onClick={() => void onAttach()}
          className="rounded-full p-1 text-muted hover:bg-hover hover:text-foreground"
        >
          <Plus aria-hidden className="size-4" />
        </button>
        <ModelButton info={info} send={sendCommand} />
        <span className="flex-1" />
        <ContextRing context={info.context} />
        <Branch branch={branch} />
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
