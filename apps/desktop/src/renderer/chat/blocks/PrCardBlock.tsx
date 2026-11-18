import { useEffect, useState } from "react";
import type { PrCard, PrCheck } from "../../../shared/api";
import { PULL_REQUEST_STATE_PRESENTATION } from "../refs/pullRequestIcons";
import { StatusGlyph } from "../../ui/StatusGlyph";

/** The card asks again every 30 s while it shows: gh and the orchestration tool send no event to the app. */
export const PR_CARD_POLL_MS = 30_000;

/** "38s", "1m 04s", "1h 02m". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${pad(Math.floor(s / 60) % 60)}m`;
}

/** The time column of a check (rich-parts.html, PR card): its run time, or "running 2m" from its start to `now`. */
export function checkTime(c: PrCheck, now: number): string {
  if (c.state === "queued") return "queued";
  if (c.state === "skipped") return "skipped";
  if (c.state === "running") {
    const s = c.startedAt === null ? 0 : Math.max(0, now - c.startedAt) / 1000;
    return s < 60 ? `running ${Math.round(s)}s` : `running ${Math.floor(s / 60)}m`;
  }
  return c.startedAt !== null && c.completedAt !== null ? duration(c.completedAt - c.startedAt) : "";
}

/** The merge state in words, from gh's state and mergeStateStatus. */
export function mergeText(card: Pick<PrCard, "state" | "merge" | "base">): string {
  if (card.state === "merged") return "merged ✓";
  if (card.state === "closed") return "closed";
  const words: Record<string, string> = { CLEAN: "ready", HAS_HOOKS: "ready", UNSTABLE: "checks not passed", BLOCKED: "blocked", BEHIND: `behind ${card.base}`, DIRTY: "conflicts", DRAFT: "draft" };
  return words[card.merge ?? ""] ?? "not known yet";
}

/** The latest review: who, and on which commit. */
export const reviewText = (r: PrCard["review"]): string => (r ? `${r.author}${r.sha ? `, on ${r.sha.slice(0, 7)}` : ""}` : "none");

/** "+312 −40" and five boxes: the share of added lines, rounded to fifths. */
function Size({ add, del }: { add: number; del: number }) {
  const total = add + del;
  const added = total === 0 ? 0 : Math.round((5 * add) / total);
  return (
    <span aria-label={`${add} lines added, ${del} removed`} data-testid="pr-size" className="inline-flex h-5 shrink-0 items-center gap-[5px] rounded-[6px] ps-[5px] pe-[6px] font-mono text-[12px] text-ink-100">
      <span className="text-[11px] text-ink-45">+{add} −{del}</span>
      <span aria-hidden className="ms-[2px] inline-flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} data-box={i < added ? "a" : "r"} className={`size-[6px] rounded-[1.5px] ${i < added ? "bg-ink-85" : "bg-ink-45"}`} />
        ))}
      </span>
    </span>
  );
}

const MARK: Record<PrCheck["state"], { text: string; label: string; ink: string } | null> = {
  pass: { text: "✓", label: "passed", ink: "text-ink-45" },
  skipped: { text: "✓", label: "skipped", ink: "text-ink-45" },
  fail: { text: "✕", label: "failed", ink: "text-ink-100" },
  running: null,
  queued: null,
};

function CheckRow({ check, now }: { check: PrCheck; now: number }) {
  const mark = MARK[check.state];
  return (
    <div data-check={check.state} className={`grid h-7 grid-cols-[16px_1fr_auto] items-center gap-[10px] border-t border-hairline px-[14px] text-[12.5px] ${check.state === "fail" ? "text-ink-100" : "text-ink-62"}`}>
      {mark ? (
        <span role="img" aria-label={mark.label} className={`text-center text-[11px] ${mark.ink}`}>{mark.text}</span>
      ) : (
        <StatusGlyph state={check.state === "running" ? "working" : "waiting"} className="w-4! text-[11px]!" />
      )}
      <span className="truncate">{check.name}</span>
      <span className="font-mono text-[11px] text-ink-38">{checkTime(check, now)}</span>
    </div>
  );
}

/** A `contr-pr` block (rich-parts.html, PR card): one PR in full, from gh and the orchestration tool. The agent writes only the number. */
export function PrCardBlock({ number }: { number: number }) {
  const [read, setRead] = useState<{ card: PrCard | null; at: number } | null>(null);
  useEffect(() => {
    let live = true;
    const ask = () => void window.contr.prCard(number).then((card) => live && setRead({ card, at: Date.now() }));
    ask();
    const id = setInterval(ask, PR_CARD_POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [number]);
  const card = read?.card ?? null;
  const look = card ? PULL_REQUEST_STATE_PRESENTATION[card.state] : null;
  const meta = card ? [`${card.branch} → ${card.base}`, `${card.files} ${card.files === 1 ? "file" : "files"}`, card.worker?.name, `head ${card.head.slice(0, 7)}`].filter((m): m is string => !!m) : [];
  return (
    <section aria-label={`PR #${number}`} data-pr-state={card?.state} className="contr-pr my-3 overflow-hidden rounded-[12px] border border-border">
      <div className="flex items-center gap-[10px] px-[14px] pt-3 pb-1">
        {look && (
          <span role="img" aria-label={look.label} className={`inline-flex ${look.toneClassName} text-(--st)`}>
            <look.Icon aria-hidden className="size-[15px]" />
          </span>
        )}
        <span className="font-mono text-[12px] text-ink-100">#{number}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-100">{card?.title}</span>
        {card && <Size add={card.additions} del={card.deletions} />}
      </div>
      {card && (
        <>
          <div data-testid="pr-meta" className="flex items-center gap-[10px] ps-[39px] pe-[14px] pb-[10px] font-mono text-[11px] text-ink-42">
            {meta.map((m, i) => (
              <span key={m} className="contents">
                {i > 0 && <span aria-hidden>·</span>}
                <span>{m}</span>
              </span>
            ))}
          </div>
          {card.checks.map((c, i) => (
            <CheckRow key={`${c.name}-${i}`} check={c} now={read!.at} />
          ))}
          <div className="flex gap-4 border-t border-hairline px-[14px] py-[9px] text-[12px] text-ink-50">
            <span data-testid="pr-review">Review: {reviewText(card.review)}</span>
            <span className="flex-1" />
            <span data-testid="pr-merge">Merge: {mergeText(card)}</span>
          </div>
        </>
      )}
    </section>
  );
}
