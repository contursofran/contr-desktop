import { Sparkle } from "lucide-react";
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import { AgentIcon } from "../../ui/AgentIcon";
import { Tip } from "../../ui/Tip";
import { useEffect, useRef, useState } from "react";
import type { CodexOption, ReplyInfo, SpeedTier } from "../../../shared/api";
import { contextTip, menuCommand, modelLabel, modelTip, PENDING_MS, shown, speedChoices, type Pending } from "./menu";

/** The helper has no event for these: the reply box asks every 3 s. */
export const REPLY_INFO_INTERVAL_MS = 3000;

const EMPTY: ReplyInfo = { agent: null, model: null, effort: null, tier: null, tiers: [], speed: null, context: null, models: [], efforts: [] };

/** The reply box's data and the agent's branch, read again every REPLY_INFO_INTERVAL_MS. */
export function useReplyInfo() {
  const [info, setInfo] = useState(EMPTY);
  const [branch, setBranch] = useState<string | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    let live = true;
    const read = () => {
      const at = revision.current;
      void window.contr.replyInfo().then((i) => {
        if (live && at === revision.current) setInfo(i);
      }).catch(() => undefined);
      void window.contr.branch().then((b) => live && setBranch(b)).catch(() => undefined);
    };
    read();
    const timer = setInterval(read, REPLY_INFO_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return { info, branch, updateInfo: (next: ReplyInfo) => { revision.current++; setInfo(next); } };
}

/** The helper's agent kinds by the icon kind of `ui/AgentIcon` (hc's names). */
const ICON_KINDS: Record<string, string> = { claude: "claude-code" };

/**
 * The model button shows the agent, model, effort and accelerated tier. Its menu has the choices the helper reports.
 */
export function ModelButton({ info, send, setTier, setCodexOption }: {
  info: ReplyInfo;
  send: (command: string) => Promise<boolean>;
  setTier: (tier: SpeedTier) => Promise<boolean>;
  setCodexOption?: (change: CodexOption) => Promise<void>;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    // Re-render once the pending choice is too old to show.
    const timer = setTimeout(() => setNow(Date.now()), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  const { model, effort, tier } = shown(info, pending, now);
  const speeds = speedChoices(model === info.model ? info.tiers : []);
  const permissions = info.permissions;
  const hasMenu = info.models.length > 0 || info.efforts.length > 0 || speeds.length > 0 || permissions !== undefined;
  const confirmedTier = pending?.tier === info.tier;
  useEffect(() => {
    if (confirmedTier) setPending((p) => p?.tier === info.tier ? { ...p, tier: undefined } : p);
  }, [confirmedTier, info.tier]);

  function choose(kind: "model" | "effort" | "tier", value: string, action: () => Promise<boolean>) {
    if (setCodexOption) {
      void setCodexOption({ kind, value });
      return;
    }
    const at = Date.now();
    setNow(at);
    setPending((p) => ({ ...(p && at - p.at < PENDING_MS ? p : {}), [kind]: value, at }));
    void action().then((ok) => {
      if (!ok) setPending((p) => p?.[kind] === value ? { ...p, [kind]: undefined } : p);
    });
  }

  const label = modelLabel(model, info.models);
  const tierLabel = tier === "fast" || tier === "ultrafast" ? tier : null;
  const permissionLabel = permissions && (permissions.choices.find((choice) => choice.value === permissions.selected)?.label ?? permissions.selected ?? "Default permissions");
  const tip = [modelTip(label, effort, info.agent, tierLabel), permissionLabel].filter(Boolean).join(" · ");
  const button = (
    <>
      {info.agent ? <AgentIcon kind={ICON_KINDS[info.agent] ?? info.agent} size={15} color="var(--color-dim)" /> : <Sparkle aria-hidden className="size-3.5" />}
      <span className="truncate text-ink-85">{label}</span>
      {effort && <span>{effort}</span>}
      {tierLabel && <span className="text-accent">{tierLabel}</span>}
      {permissionLabel && <span className="truncate">{permissionLabel}</span>}
    </>
  );
  const buttonClass = "-mx-1.5 flex min-w-0 items-center whitespace-nowrap gap-2 rounded-md px-1.5 py-0.5 text-xs text-dim hover:bg-hover [&>svg]:shrink-0";
  if (!hasMenu) {
    return <Tip label={tip} side="top"><button type="button" aria-label="Model" className={buttonClass}>{button}</button></Tip>;
  }
  const group = <T extends string>(title: string, choices: { value: T; label: string }[], value: string | null, select: (value: T) => void) => (
    <MenuGroup>
      <MenuGroupLabel className="px-2 pt-1 pb-0.5 text-xs text-muted">{title}</MenuGroupLabel>
      <MenuRadioGroup value={value ?? ""} onValueChange={(v) => {
        const choice = choices.find((c) => c.value === v);
        if (choice) select(choice.value);
      }}>
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
      <MenuContent side="top" align="start" sideOffset={4} className="m-0 max-h-(--available-height) w-56 overflow-y-auto rounded-lg border border-border bg-raised p-1 shadow outline-hidden focus-visible:ring-2 focus-visible:ring-focus">
        {info.models.length > 0 && group("Model", info.models, model, (value) => choose("model", value, () => send(menuCommand("model", value))))}
        {info.models.length > 0 && info.efforts.length > 0 && <MenuSeparator className="my-1 border-t border-border" />}
        {info.efforts.length > 0 && group("Effort", info.efforts, effort, (value) => choose("effort", value, () => send(menuCommand("effort", value))))}
        {speeds.length > 0 && (info.models.length > 0 || info.efforts.length > 0) && <MenuSeparator className="my-1 border-t border-border" />}
        {speeds.length > 0 && group("Speed", speeds, tier, (value) => choose("tier", value, () => setTier(value)))}
        {permissions && setCodexOption && <>
          {(info.models.length > 0 || info.efforts.length > 0 || speeds.length > 0) && <MenuSeparator className="my-1 border-t border-border" />}
          {group("Permissions", permissions.choices, permissions.selected, (value) => void setCodexOption({ kind: "permission", value }))}
        </>}
      </MenuContent>
    </Menu>
  );
}

export function OutputSpeed({ speed }: { speed: ReplyInfo["speed"] }) {
  return speed && <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-dim">{speed}</span>;
}

/** The context ring with its percent in mono. The helper's `warn` (80% or more) shows it in bright ink (`ink-100`): red is only "needs you" (D134). The tooltip says it in plain words. */
export function ContextRing({ context }: { context: ReplyInfo["context"] }) {
  if (!context) return null;
  const r = 6;
  const length = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, context.percent)) / 100) * length;
  return (
    <Tip label={contextTip(context.percent)} side="top">
      <span role="img" tabIndex={0} aria-label={`Context ${context.percent}%`} className={`flex items-center gap-1 font-mono rounded-sm text-[11px] outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${context.warn ? "text-ink-100" : "text-dim"}`}>
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
    <span role="img" aria-label={`Branch: ${branch}`} className="min-w-[4ch] max-w-48 shrink-[10] truncate font-mono text-[11px] text-dim">
      {branch}
    </span>
  );
}
