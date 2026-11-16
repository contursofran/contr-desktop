import type { ReplyInfo } from "../../../shared/api";

/** How long a choice shows before the helper agrees (herdr-contr #208). */
export const PENDING_MS = 15_000;

/** A choice made in the menu, shown until the helper's answer agrees or PENDING_MS pass. */
export interface Pending {
  model?: string;
  effort?: string;
  at: number;
}

/** The model's label from the menu's list, else the id itself; "Model" when the helper does not know it (herdr-contr #209). */
export function modelLabel(model: string | null, models: ReplyInfo["models"]): string {
  if (!model) return "Model";
  return models.find((m) => m.value === model)?.label ?? model;
}

/** The model and effort to show: a pending choice wins until the helper agrees or it is too old. */
export function shown(info: ReplyInfo, pending: Pending | null, now: number): { model: string | null; effort: string | null } {
  const live = pending && now - pending.at < PENDING_MS ? pending : null;
  return {
    model: live?.model && live.model !== info.model ? live.model : info.model,
    effort: live?.effort && live.effort !== info.effort ? live.effort : info.effort,
  };
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
