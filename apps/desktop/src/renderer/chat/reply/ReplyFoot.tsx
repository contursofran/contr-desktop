import { Sparkle } from "lucide-react";
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import { AgentIcon } from "../../ui/AgentIcon";
import { Tip } from "../../ui/Tip";
import { useEffect, useState } from "react";
import type { ReplyInfo } from "../../../shared/api";
import { contextTip, menuCommand, modelLabel, modelTip, PENDING_MS, shown, type Pending } from "./menu";

/** The helper has no event for these: the reply box asks every 3 s. */
export const REPLY_INFO_INTERVAL_MS = 3000;

const EMPTY: ReplyInfo = { agent: null, model: null, effort: null, context: null, models: [], efforts: [] };

/** The reply box's data and the agent's branch, read again every REPLY_INFO_INTERVAL_MS. */
export function useReplyInfo(): { info: ReplyInfo; branch: string | null } {
  const [info, setInfo] = useState(EMPTY);
  const [branch, setBranch] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => {
      void window.contr.replyInfo().then((i) => live && setInfo(i)).catch(() => undefined);
      void window.contr.branch().then((b) => live && setBranch(b)).catch(() => undefined);
    };
    read();
    const timer = setInterval(read, REPLY_INFO_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return { info, branch };
}

/** The helper's agent kinds by the icon kind of `ui/AgentIcon` (hc's names). */
const ICON_KINDS: Record<string, string> = { claude: "claude-code" };

/**
 * The model button (agent icon, model, effort; no chevron, as the mock) and its menu with a "Model" and an "Effort" group. A choice sends `/model` or `/effort`.
 * The button stays on one line (it does not shrink); its tooltip names model, effort and program.
 */
export function ModelButton({ info, send }: { info: ReplyInfo; send: (command: string) => Promise<boolean> }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    // Re-render once the pending choice is too old to show.
    const timer = setTimeout(() => setNow(Date.now()), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  const { model, effort } = shown(info, pending, now);
  const hasMenu = info.models.length > 0 || info.efforts.length > 0;

  function choose(kind: "model" | "effort", value: string) {
    const at = Date.now();
    setNow(at);
    setPending((p) => ({ ...(p && at - p.at < PENDING_MS ? p : {}), [kind]: value, at }));
    void send(menuCommand(kind, value)).then((ok) => !ok && setPending(null));
  }

  const label = modelLabel(model, info.models);
  const tip = modelTip(label, effort, info.agent);
  const button = (
    <>
      {info.agent ? <AgentIcon kind={ICON_KINDS[info.agent] ?? info.agent} size={15} color="var(--color-dim)" /> : <Sparkle aria-hidden className="size-3.5" />}
      <span className="text-ink-85">{label}</span>
      {effort && <span>{effort}</span>}
    </>
  );
  const buttonClass = "-mx-1.5 flex shrink-0 items-center whitespace-nowrap gap-2 rounded-md px-1.5 py-0.5 text-xs text-dim hover:bg-hover";
  if (!hasMenu) {
    return <Tip label={tip} side="top"><button type="button" aria-label="Model" className={buttonClass}>{button}</button></Tip>;
  }
  const group = (kind: "model" | "effort", title: string, choices: ReplyInfo["models"], value: string | null) => (
    <MenuGroup>
      <MenuGroupLabel className="px-2 pt-1 pb-0.5 text-xs text-muted">{title}</MenuGroupLabel>
      <MenuRadioGroup value={value ?? ""} onValueChange={(v) => choose(kind, String(v))}>
        {choices.map((c) => (
          <MenuRadioItem key={c.value} value={c.value} closeOnSelect className="w-full cursor-default rounded px-2 py-1 text-left text-sm text-foreground outline-none data-checked:bg-selected data-highlighted:bg-hover">
            {c.label}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </MenuGroup>
  );
  return (
    <Menu>
      <Tip label={tip} side="top"><MenuTrigger aria-label="Model" className={buttonClass}>{button}</MenuTrigger></Tip>
      <MenuContent side="top" align="start" sideOffset={4} className="m-0 w-56 rounded-lg border border-border bg-raised p-1 shadow">
        {info.models.length > 0 && group("model", "Model", info.models, model)}
        {info.models.length > 0 && info.efforts.length > 0 && <MenuSeparator className="my-1 border-t border-border" />}
        {info.efforts.length > 0 && group("effort", "Effort", info.efforts, effort)}
      </MenuContent>
    </Menu>
  );
}

/** The context ring with its percent in mono. The helper's `warn` (80% or more) shows it in bright ink (`ink-100`): red is only "needs you" (D134). The tooltip says it in plain words. */
export function ContextRing({ context }: { context: ReplyInfo["context"] }) {
  if (!context) return null;
  const r = 6;
  const length = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, context.percent)) / 100) * length;
  return (
    <Tip label={contextTip(context.percent)} side="top">
      <span tabIndex={0} aria-label={`Context ${context.percent}%`} className={`flex items-center gap-1 font-mono text-[11px] outline-none ${context.warn ? "text-ink-100" : "text-dim"}`}>
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-meter-track" />
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" stroke="currentColor" strokeDasharray={`${filled} ${length}`} />
      </svg>
      {context.percent}%
      </span>
    </Tip>
  );
}

/** The agent's branch, in mono. */
export function Branch({ branch }: { branch: string | null }) {
  if (!branch) return null;
  return (
    <span aria-label="Branch" className="max-w-48 truncate font-mono text-[11px] text-dim">
      {branch}
    </span>
  );
}
