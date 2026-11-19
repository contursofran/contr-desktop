import { useContext } from "react";
import type { Digest } from "../../../shared/api";
import { ChatDigests, digestKey, DigestRow } from "./digestRead";

/** The four cells in the mock's order. Red only for the count that waits for the owner, and only when it is not 0. */
export function digestCells(d: Digest | null): { key: keyof Digest; n: string; label: string; you: boolean }[] {
  const cell = (key: "merged" | "busy" | "waiting" | "failing", one: string, many: string) => {
    const v = d?.[key] ?? null;
    return { key, n: v === null ? "—" : String(v), label: v === 1 ? one : many, you: key === "waiting" && (v ?? 0) > 0 };
  };
  return [cell("merged", "PR merged", "PRs merged"), cell("busy", "worker busy", "workers busy"), cell("waiting", "waits for you", "wait for you"), cell("failing", "CI failure", "CI failures")];
}

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Use the chat separator's date form on both ends when the span crosses a local day. */
export function digestSpan(since: number | null, end: number | null): string {
  if (since === null || end === null) return "";
  const crossesDay = new Date(since).toDateString() !== new Date(end).toDateString();
  const time = (at: number) => crossesDay ? `${day.format(at).replace(",", "")} ${clock.format(at)}` : clock.format(at);
  return `${time(since)} → ${time(end)}`;
}

/** A `contr-digest` block: "Since you left", with what changed, from gh and the orchestration tool. */
export function DigestBlock({ offset }: { offset: number | undefined }) {
  const chat = useContext(ChatDigests);
  const rowId = useContext(DigestRow);
  const range = rowId === undefined ? undefined : chat?.ranges.get(rowId);
  const read = rowId !== undefined && offset !== undefined ? chat?.reads.get(digestKey(rowId, offset)) : undefined;
  const span = read ? digestSpan(read.digest.since, read.at) : digestSpan(range?.since ?? null, range?.end ?? null);
  return (
    <section aria-label="Since you left" className="contr-digest my-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-[10px]">
        <span className="text-[14px] font-medium text-ink-100">Since you left</span>
        {span && <span data-testid="digest-span" className="font-mono text-[11px] text-dim">{span}</span>}
      </div>
      <div className="grid grid-cols-4 border-y border-hairline">
        {digestCells(read?.digest ?? null).map((c, i) => (
          <div key={c.key} data-cell={c.key} className={`flex flex-col gap-px py-[10px] pr-1 ${i === 0 ? "pl-[6px]" : "border-l border-hairline pl-4"}`}>
            <span className={`text-[20px] leading-[26px] font-medium tabular-nums ${c.you ? "text-blocked" : "text-ink-100"}`}>{c.n}</span>
            <span className="text-[11.5px] text-dim">{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
