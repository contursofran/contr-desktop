import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import type { ISearchResultChangeEvent } from "@xterm/addon-search";
import { useColorScheme } from "../chat/markdown/useColorScheme";

const button = "rounded p-1 hover:bg-hover disabled:opacity-40";

export function TerminalFind({ input, result, find, close }: {
  input: RefObject<HTMLInputElement | null>;
  result: ISearchResultChangeEvent;
  find: (query: string, direction: "incremental" | "next" | "previous") => void;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const scheme = useColorScheme();
  useEffect(() => input.current?.focus(), [input]);
  useEffect(() => find(query, "incremental"), [find, query, scheme]);
  const { resultIndex, resultCount } = result;
  const count = resultIndex < 0 ? String(resultCount) : `${resultIndex + 1} of ${resultCount}`;

  return (
    <div role="search" aria-label="Find in terminal"
      className="absolute right-6 top-12 z-10 flex max-w-[calc(100%-3rem)] items-center gap-1 rounded-md border border-input-line bg-raised p-1 text-xs shadow-[var(--shadow-float)]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <input ref={input} aria-label="Find in terminal" placeholder="Find" value={query}
        className="w-36 min-w-0 rounded border border-input-line px-2 py-1 focus-visible:outline focus-visible:outline-focus"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          find(query, event.shiftKey ? "previous" : "next");
        }}
      />
      <output aria-label="Match count" className="shrink-0 px-1 text-muted">{query ? count : ""}</output>
      <button type="button" aria-label="Previous match" className={button} disabled={!resultCount} onClick={() => find(query, "previous")}><ArrowUp size={14} /></button>
      <button type="button" aria-label="Next match" className={button} disabled={!resultCount} onClick={() => find(query, "next")}><ArrowDown size={14} /></button>
      <button type="button" aria-label="Close find" className={button} onClick={close}><X size={14} /></button>
    </div>
  );
}
