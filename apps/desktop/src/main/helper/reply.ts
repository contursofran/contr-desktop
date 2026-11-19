import type { AcceleratedTier, ReplyInfo, SpeedTier } from "../../shared/api";
import { runHelper, type HelperLine } from "./run";

type Choice = { value: string; label: string; tiers?: unknown };

function isAcceleratedTier(value: unknown): value is AcceleratedTier {
  return value === "fast" || value === "ultrafast";
}

/** The `args` of one command in the helper's `commands` answer, as {value, label}. */
function commandArgs(commands: HelperLine | undefined, name: string): Choice[] {
  const list = Array.isArray(commands?.commands) ? (commands.commands as { name?: unknown; args?: unknown }[]) : [];
  const args = list.find((c) => c.name === name)?.args;
  if (!Array.isArray(args)) return [];
  return args.flatMap((a: unknown) => {
    if (typeof a === "string") return [{ value: a, label: a }];
    const o = a as { value?: unknown; label?: unknown; tiers?: unknown };
    return typeof o?.value === "string" ? [{ value: o.value, label: typeof o.label === "string" ? o.label : o.value, tiers: o.tiers }] : [];
  });
}

/** Reads the reply box's data from the helper's `model`, `status` and `commands` lines. Unknown parts are null or empty. */
export function readReplyInfo(model: HelperLine[], status: HelperLine[], commands: HelperLine[]): ReplyInfo {
  const m = model.find((l) => l.type === "model");
  const s = status.find((l) => l.type === "status");
  const c = commands.find((l) => l.type === "commands");
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const tags = Array.isArray(s?.tags) ? (s.tags as { kind?: unknown; text?: unknown; percent?: unknown; warn?: unknown }[]) : [];
  const ctx = tags.find((t) => t.kind === "context");
  const modelId = str(m?.model);
  const models = commandArgs(c, "model");
  const tiers = models.find((choice) => choice.value === modelId)?.tiers;
  return {
    agent: str(m?.agent) ?? str(c?.agent),
    model: modelId,
    effort: str(m?.effort),
    tier: str(m?.tier),
    tiers: Array.isArray(tiers) ? tiers.filter(isAcceleratedTier) : [],
    speed: str(tags.find((t) => t.kind === "speed")?.text),
    context:
      ctx && typeof ctx.percent === "number"
        ? { percent: ctx.percent, text: str(ctx.text) ?? `${ctx.percent}%`, warn: ctx.warn === true }
        : null,
    models: models.map(({ value, label }) => ({ value, label })),
    efforts: commandArgs(c, "effort").map(({ value, label }) => ({ value, label })),
  };
}

/** Sets a tier through the helper. A sent command may take another answer to show in `model`. */
export async function setReplyTier(helper: string, terminal: string, tier: SpeedTier): Promise<{ ok: boolean; message?: string }> {
  if (tier !== "standard" && !isAcceleratedTier(tier)) return { ok: false, message: "Unknown speed tier" };
  const lines = await runHelper(helper, ["tier", "--terminal", terminal, "--tier", tier]);
  const error = lines.find((line) => line.type === "error");
  const done = lines.find((line) => line.type === "done");
  if (!error && (done?.result === "sent" || done?.result === "unchanged")) return { ok: true };
  const message = error?.message ?? done?.message;
  return { ok: false, message: typeof message === "string" ? message : "Could not set the speed tier" };
}

/** Calls the helper for the reply box. `commands` changes seldom: the caller keeps its answer. */
export async function replyInfo(helper: string, terminal: string, commands: Promise<HelperLine[]>): Promise<ReplyInfo> {
  const t = ["--terminal", terminal];
  const [model, status] = await Promise.all([runHelper(helper, ["model", ...t]), runHelper(helper, ["status", ...t])]);
  return readReplyInfo(model, status, await commands);
}

/** Keeps each terminal's `commands` answer. An answer with an `error` line is not kept: the next call asks again. */
export function cachedCommands(run: (terminal: string) => Promise<HelperLine[]>): (terminal: string) => Promise<HelperLine[]> {
  const kept = new Map<string, Promise<HelperLine[]>>();
  return (terminal) => {
    const known = kept.get(terminal);
    if (known) return known;
    const answer = run(terminal);
    kept.set(terminal, answer);
    void answer.then((lines) => {
      if (lines.some((l) => l.type === "error") && kept.get(terminal) === answer) kept.delete(terminal);
    });
    return answer;
  };
}
