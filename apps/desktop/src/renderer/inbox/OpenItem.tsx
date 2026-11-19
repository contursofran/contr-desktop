import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OwnerQuestion, OwnerTodo } from "../../shared/api";
import { CardText, primaryButton } from "../chat/card/Card";
import { ChatMarkdown } from "../chat/markdown/ChatMarkdown";
import { splitTodo } from "../chat/owner/blocks";
import { OwnerQuestionAnswers, useOwnerRun } from "../chat/owner/OwnerQuestionAnswers";
import { RefChip } from "../chat/refs/RefChip";
import { StatusGlyph } from "../ui/StatusGlyph";

/** A copy button shows its check this long. */
const COPY_MS = 1_500;

/**
 * The open item (screens.html screen 4, `.ibx.is-open`): the row is the card. The glyph keeps the row's first
 * column; the body spans the other columns, 8 px to the left. The row after it has no top line.
 */
function OpenRow({ label, item, glyph, id, sub, children }: { label: string; item: string; glyph: "blocked" | "idle"; id: string; sub: string; children: ReactNode }) {
  return (
    <section aria-label={label} data-item={item} className="my-1.5 grid grid-cols-[16px_36px_1fr_auto] items-start gap-x-3 rounded-xl border border-border bg-chrome py-3 pr-3 pl-2.5 text-[13px] [&+div]:border-t-0">
      <StatusGlyph state={glyph} className="mt-px" />
      <div className="col-span-3 -ml-2 flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-2.5 px-3 pb-1.5">
          <span className="font-mono text-[11px] text-dim">{id}</span>
          <span className="min-w-0 text-[11.5px] text-dim">{sub}</span>
        </p>
        {children}
      </div>
    </section>
  );
}

const ErrorLine = ({ text }: { text: string | null }) => (text ? <p role="alert" className="px-3 pt-1 text-xs text-error">{text}</p> : null);

export function OpenQuestion({ q, sub, onSaved }: { q: OwnerQuestion; sub: string; onSaved: (n: string) => void }) {
  return (
    <OpenRow label="Owner question" item={q.id} glyph="blocked" id={q.id} sub={sub}>
      <CardText>{q.question}</CardText>
      <OwnerQuestionAnswers q={q} onSaved={onSaved} errorColor="text-error">
        {q.refs.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 px-3 pt-1.5 pb-0.5 text-xs text-dim">
            <span>Refs</span>
            {q.refs.map((r) => {
              const n = /^#(\d+)$/.exec(r)?.[1];
              return n ? <RefChip key={r} number={Number(n)}>{r}</RefChip> : <span key={r} className="font-mono text-[11px] text-muted">{r}</span>;
            })}
          </p>
        )}
      </OwnerQuestionAnswers>
    </OpenRow>
  );
}

/** An open to-do: its text, each command with a Copy button, then Done. */
export function OpenTodo({ t, sub, onSaved }: { t: OwnerTodo; sub: string; onSaved: (n: string) => void }) {
  const { off, error, go } = useOwnerRun(onSaved);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPY_MS);
    });
  };
  const row = (id: string, code: string, block: boolean) => (
    <div key={id} className="mt-1 flex items-center gap-2 rounded-lg border border-hairline px-2 py-1 font-mono text-xs text-ink-85">
      <span className={`min-w-0 flex-1 ${block ? "whitespace-pre-wrap" : "truncate"}`}>{code}</span>
      <button type="button" aria-label={copied === id ? "Copied" : `Copy ${code}`} onClick={() => copy(id, code)} className="flex size-[22px] shrink-0 items-center justify-center rounded hover:bg-hover">
        {copied === id ? <CheckIcon className="size-3.5 text-foreground" /> : <CopyIcon className="size-3.5 text-dim" />}
      </button>
    </div>
  );
  return (
    <OpenRow label="Owner to-do" item={t.id} glyph="idle" id={t.id} sub={sub}>
      <div className="px-3 text-[13.5px] text-ink-90">
        {splitTodo(t.text).map((b, i) =>
          b.kind === "code" ? row(`c${i}`, b.code, true) : (
            <div key={`p${i}`}>
              <ChatMarkdown text={b.text} />
              {b.spans.map((s, j) => row(`s${i}.${j}`, s, false))}
            </div>
          ),
        )}
      </div>
      <ErrorLine text={error} />
      <div className="flex justify-end pt-1.5">
        <button type="button" disabled={off} onClick={() => void go(() => window.contr.ownerDone(t.id))} className={primaryButton}>Done</button>
      </div>
    </OpenRow>
  );
}
