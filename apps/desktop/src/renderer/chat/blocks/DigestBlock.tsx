import { useEffect, useState } from "react";
import type { Digest } from "../../../shared/api";

/** The digest asks again every 30 s while it shows: gh and the orchestration tool send no event to the app. */
export const DIGEST_POLL_MS = 30_000;

/** The four cells in the mock's order. Red only for the count that waits for the owner, and only when it is not 0. */
export function digestCells(d: Digest | null): { key: keyof Digest; n: string; label: string; you: boolean }[] {
  const cell = (key: "merged" | "busy" | "waiting" | "failing", one: string, many: string) => {
    const v = d?.[key] ?? null;
    return { key, n: v === null ? "–" : String(v), label: v === 1 ? one : many, you: key === "waiting" && (v ?? 0) > 0 };
  };
  return [cell("merged", "PR merged", "PRs merged"), cell("busy", "worker busy", "workers busy"), cell("waiting", "waits for you", "wait for you"), cell("failing", "CI failure", "CI failures")];
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "14:02 → 15:00": from the owner's last message to the read. Empty when no owner message is known. */
export const digestSpan = (since: number | null, now: number): string => (since === null ? "" : `${hhmm(since)} → ${hhmm(now)}`);

/** A `contr-digest` block: "Since you left", with what changed, from gh and the orchestration tool. */
export function DigestBlock() {
  const [read, setRead] = useState<{ digest: Digest; at: number } | null>(null);
  useEffect(() => {
    let live = true;
    const ask = () => void window.contr.digest().then((digest) => live && setRead({ digest, at: Date.now() }));
    ask();
    const id = setInterval(ask, DIGEST_POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  const span = read ? digestSpan(read.digest.since, read.at) : "";
  return (
    <section aria-label="Since you left" className="contr-digest my-3 flex flex-col gap-2">
      <div className="flex items-baseline gap-[10px]">
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
