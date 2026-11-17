import { useEffect, useState } from "react";
import { ErrorNote } from "../ui/ErrorNote";
import { PathText } from "../ui/PathText";

/** The helper's error codes in plain words, as herdr-contr's chat says them (mods/herdr-contr/chat.js, `problem`). */
const SAY: Record<string, string> = {
  "not-agent": "This terminal runs no agent.",
  "no-terminal": "This agent's terminal is gone.",
  "no-core": "hc is not running.",
  core: "hc did not answer.",
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
 * A failed `feed` in the reading column (ui/ErrorNote.tsx): what failed, the error text in mono,
 * the helper's path as Settings shows it (with its tooltip and Copy), and Retry, which starts the feed again.
 */
export function HelperError({ error, onRetry }: { error: { code: string; message: string }; onRetry: () => void }) {
  const [helper, setHelper] = useState("");
  useEffect(() => void window.contr.settings().then((s) => setHelper(s.helper)), []);
  return (
    <div className="flex min-h-0 flex-1 items-center px-4">
      <ErrorNote label="Helper error" problem={helperProblem(error)} detail={`${error.code}: ${error.message}`} onRetry={onRetry}>
        <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Helper</span>
          <PathText label="Helper path" path={helper} />
        </p>
      </ErrorNote>
    </div>
  );
}
