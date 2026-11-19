import type { ReplyInfo, SpeedTier } from "../../../shared/api";

/** How long a choice shows before the helper agrees (herdr-contr #208). */
export const PENDING_MS = 15_000;

/** A choice made in the menu, shown until the helper's answer agrees or PENDING_MS pass. */
export interface Pending {
  model?: string;
  effort?: string;
  tier?: SpeedTier;
  at: number;
}

/** The model's label from the menu's list, else the id itself; "Model" when the helper does not know it (herdr-contr #209). */
export function modelLabel(model: string | null, models: ReplyInfo["models"]): string {
  if (!model) return "Model";
  return models.find((m) => m.value === model)?.label ?? model;
}

/** A pending choice wins until the helper agrees or the pending time ends. */
export function shown(info: ReplyInfo, pending: Pending | null, now: number) {
  const live = pending && now - pending.at < PENDING_MS ? pending : null;
  return {
    model: live?.model && live.model !== info.model ? live.model : info.model,
    effort: live?.effort && live.effort !== info.effort ? live.effort : info.effort,
    tier: live?.tier ?? info.tier,
  };
}

export function speedChoices(tiers: ReplyInfo["tiers"]): { value: SpeedTier; label: string }[] {
  if (tiers.length === 0) return [];
  const choices: { value: SpeedTier; label: string }[] = [{ value: "standard", label: "Standard" }];
  if (tiers.includes("fast")) choices.push({ value: "fast", label: "Fast" });
  if (tiers.includes("ultrafast")) choices.push({ value: "ultrafast", label: "Ultrafast" });
  return choices;
}

/** The command that the menu sends: the helper has no command that sets the model or effort. */
export function menuCommand(kind: "model" | "effort", value: string): string {
  return `/${kind} ${value}`;
}

/** Runs tasks one after the other: a menu choice made during a send waits for the send (herdr-contr #209). */
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/** Program names by the helper's agent kind. Another kind shows as it is. */
const PROGRAMS: Record<string, string> = { claude: "Claude Code", codex: "Codex" };

/** The model button's tooltip with only the known parts. */
export function modelTip(label: string, effort: string | null, agent: string | null, tier?: string | null): string {
  return [label, effort && `${effort} effort`, tier, agent && (PROGRAMS[agent] ?? agent)].filter(Boolean).join(" · ");
}

/** The context ring's tooltip in plain words, not the helper's tag text. */
export function contextTip(percent: number): string {
  return `${percent}% of the model's context window`;
}

/**
 * The reply box's placeholder: "Reply to <title>", else "Reply" while the title is not known.
 * "Terminal" is the fallback of main/helper/title.ts `readTabDetails` for a terminal with no title and no agent.
 */
export function replyPlaceholder(title: string): string {
  return title === "" || title === "Terminal" ? "Reply" : `Reply to ${title}`;
}
