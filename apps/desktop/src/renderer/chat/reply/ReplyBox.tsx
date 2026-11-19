// Inset focus ring adapted from t3code apps/web/src/components/chat/ChatHeader.tsx
// (b5554ac8114f2ce7ce8b5973690ccb8cbb248efd, MIT). Use the contr focus token.
import { Plus } from "lucide-react";
import type { CodexOption, SpeedTier } from "../../../shared/api";
import { codexThreadId } from "../../../shared/codex";
import { Tip } from "../../ui/Tip";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Attachments } from "./Attachments";
import { addImage, readDraft, removeImage, saveDraft } from "./drafts";
import { composeMessage, isSendKey } from "./message";
import { replyPlaceholder, serial } from "./menu";
import { cutSent, outbox } from "./outbox";
import { Branch, ContextRing, ModelButton, OutputSpeed, useReplyInfo } from "./ReplyFoot";

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
 * Enter during a send queues the new text and images; a good send clears only what it sent (`outbox.ts`).
 * `keyboard`: true when the box may take the keyboard, false while a card owns the card keys, undefined until the chat
 * has its first full answer (the card is known then).
 * `focusFrom` is the control focused when the owner opened the chat.
 */
export function ReplyBox({ terminal, title, draft, keyboard, focusFrom }: {
  terminal: string; title: string; draft?: Draft; keyboard?: boolean; focusFrom: Element | null;
}) {
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
  const placeholder = replyPlaceholder(title);
  const { info, branch, updateInfo } = useReplyInfo();
  // Messages and menu commands go one after the other: a menu choice made during a send is not lost.
  const queue = useRef(serial()).current;
  const sendText = (body: string) =>
    queue(() => window.contr.send(body)).catch((e: unknown) => ({ ok: false, message: String(e) }));
  const [out] = useState(() => outbox(queue, (body) => window.contr.send(body)));
  // The outbox is not React state: a change in it renders the box again (the Send button).
  const [, setQueued] = useState(0);
  const untaken = out.untaken({ text, images });
  const message = composeMessage(untaken.text, untaken.images);
  useKeyboard(box, keyboard, focusFrom);

  async function sendCommand(command: string): Promise<boolean> {
    const result = await sendText(command);
    if (!result.ok) setError(result.message ?? "send failed");
    return result.ok;
  }

  async function setTier(tier: SpeedTier): Promise<boolean> {
    setError(null);
    const result = await queue(() => window.contr.setTier(terminal, tier)).catch((e: unknown) => ({ ok: false, message: String(e) }));
    if (!result.ok) setError(result.message ?? "Could not set the speed tier");
    return result.ok;
  }

  async function setCodexOption(change: CodexOption) {
    setError(null);
    const result = await queue(() => window.contr.setCodexOption(terminal, change))
      .catch((error: unknown) => ({ error: String(error) }));
    if ("error" in result) setError(result.error);
    else updateInfo(result);
  }

  async function send() {
    const sending = out.take({ text, images });
    if (!sending) return;
    setError(null);
    setQueued((n) => n + 1);
    const result = await sending.done;
    setQueued((n) => n + 1);
    if (result.skipped) return;
    if (!result.ok) return setError(result.message ?? "send failed");
    // Only the sent part leaves: what the owner typed or attached during the send stays.
    // The chat can be gone by now: the stored draft changes too.
    const { part } = sending;
    saveDraft(terminal, cutSent(readDraft(terminal), part));
    setText((t) => cutSent({ text: t, images: [] }, part).text);
    setImages((i) => cutSent({ text: "", images: i }, part).images);
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
      className="mx-auto mb-4 flex w-full max-w-read flex-col gap-3.5 rounded-xl border border-input-line bg-chrome pt-[11px] pr-3 pb-[9px] pl-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <Attachments images={images} onRemove={detach} />
      <textarea
        ref={box}
        aria-label={placeholder}
        placeholder={placeholder}
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={(event) => void onPaste(event)}
        className="w-full resize-none bg-transparent text-[13px] leading-[18px] text-foreground placeholder:text-faint outline-none"
      />
      {error && (
        <p role="alert" className="-mt-2 text-xs text-error">
          Not sent: {error}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-dim">
        <Tip label="Attach image" side="top">
          <button type="button" aria-label="Attach image" onClick={() => void onAttach()} className="grid size-[18px] place-items-center rounded-md text-dim hover:bg-hover hover:text-foreground">
            <Plus aria-hidden className="size-3.5" />
          </button>
        </Tip>
        <ModelButton info={info} send={sendCommand} setTier={setTier} setCodexOption={codexThreadId(terminal) ? setCodexOption : undefined} />
        <span className="flex-1" />
        <ContextRing context={info.context} />
        <OutputSpeed speed={info.speed} />
        <Branch branch={branch} />
        <button
          type="submit"
          aria-label="Send"
          disabled={message === ""}
          className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-xs text-canvas disabled:bg-[var(--hover-strong)] disabled:text-dim"
        >
          ↑
        </button>
      </div>
    </form>
  );
}

/** Tabs keep focus for keyboard navigation. Text fields, menus and dialogs keep focus while in use. */
const HOLDS = "textarea, input, select, [contenteditable]:not([contenteditable=false]), [role=tab], [role=menu], [role=listbox], [role=combobox], [role=dialog]";

/**
 * The box takes the keyboard when the chat shows (docs/design/recipe-herdr.md): once when `keyboard` is first known
 * (at start, on another agent's chat, back from Terminal), and when the window becomes active. Never on a redraw or a
 * new message. It does not take the keyboard while a card owns the card keys (`keyboard` false), from another text
 * field, a menu or a dialog, or while text is selected (a selection stays).
 * At startup, the first answer can move focus only from the page body. After the owner opens a chat, the box can
 * also take focus from the control that opened it. A control focused while the chat loads keeps focus.
 */
function useKeyboard(box: { current: HTMLTextAreaElement | null }, keyboard: boolean | undefined, focusFrom: Element | null) {
  const may = useRef(keyboard);
  may.current = keyboard;
  const take = useCallback((from: Element | null) => {
    const el = box.current;
    const active = document.activeElement;
    if (!may.current || !el || active === el) return;
    if (active !== document.body && active !== from) return;
    if (active?.closest(HOLDS) || !(document.getSelection()?.isCollapsed ?? true)) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [box]);
  const known = keyboard !== undefined;
  useEffect(() => {
    if (known) take(focusFrom);
  }, [known, focusFrom, take]);
  useEffect(() => {
    const onActive = () => take(document.activeElement);
    window.addEventListener("focus", onActive);
    return () => window.removeEventListener("focus", onActive);
  }, [take]);
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
