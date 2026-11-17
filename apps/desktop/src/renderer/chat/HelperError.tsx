import { useEffect, useState } from "react";

/** The helper's error codes in plain words, as herdr-contr's chat says them (mods/herdr-contr/chat.js, `problem`). */
const SAY: Record<string, string> = {
  "not-agent": "This terminal runs no agent.",
  "no-terminal": "This agent's terminal is gone.",
  "no-core": "herdr-core is not running.",
  core: "herdr-core did not answer.",
  locate: "This agent's conversation was not found yet.",
  read: "This agent's conversation could not be read.",
  protocol: "The herdr-contr helper does not match this version. Install both again.",
};

/** What failed, in plain words. The code `helper` is this app's: the helper did not run or gave a broken answer. */
export function helperProblem(error: { code: string; message: string }): string {
  if (error.code === "helper") return error.message.includes("ENOENT") ? "The herdr-contr helper is missing." : "The herdr-contr helper did not answer.";
  return SAY[error.code] ?? "The conversation could not be loaded.";
}

/**
 * A failed `feed` in the reading column, in the card's look (chat/card/Card.tsx): what failed, the error text in mono,
 * the helper's path as Settings shows it, and Retry, which starts the feed again.
 */
export function HelperError({ error, onRetry }: { error: { code: string; message: string }; onRetry: () => void }) {
  const [helper, setHelper] = useState("");
  useEffect(() => void window.contr.settings().then((s) => setHelper(s.helper)), []);
  return (
    <div className="flex min-h-0 flex-1 items-center px-4">
      <section role="alert" aria-label="Helper error" className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-raised p-3 text-sm">
        <p className="font-semibold">{helperProblem(error)}</p>
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-canvas p-2 font-mono text-xs">{error.code}: {error.message}</pre>
        <p className="mt-2 flex min-w-0 gap-2 text-xs text-muted">
          <span className="shrink-0">Helper</span>
          <span aria-label="Helper path" className="min-w-0 truncate font-mono text-[11px]">{helper}</span>
        </p>
        <button type="button" onClick={onRetry} className="mt-2 flex items-center gap-2 rounded-md border border-border px-3 py-1 hover:bg-hover">
          Retry
        </button>
      </section>
    </div>
  );
}
