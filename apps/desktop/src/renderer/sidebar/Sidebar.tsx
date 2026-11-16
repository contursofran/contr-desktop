import { Bot, Folder } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Sidebar as SidebarData, SidebarAgent } from "../../shared/api";
import { StateMark } from "../chat/blocks/Marks";
import { Foot } from "./Foot";
import { Head } from "./Head";
import { type Changes, duration, load, save, tip, track } from "./ages";
import claude from "./icons/claude.svg?raw";
import codex from "./icons/codex.svg?raw";

/** The SVG text as a one-color glyph: each fill takes the current color, as Herdr's tinted `svg()` does. */
const glyph = (raw: string) => raw.replace(/<!--[\s\S]*?-->/g, "").replace(/fill="#[0-9a-fA-F]+"/g, 'fill="currentColor"').replace(/ (width|height)="1em"/g, ' $1="100%"');
const ICONS: Record<string, string> = { "claude-code": glyph(claude), codex: glyph(codex) };
const TINT: Record<string, string> = { working: "var(--color-working)", done: "var(--color-done)", blocked: "var(--color-blocked)" };

/** The agent's icon from hc's `agent` kind, a one-color glyph in its state's color (muted when idle); a bot for another kind. */
function AgentIcon({ agent, size }: { agent: SidebarAgent; size: number }) {
  const color = TINT[agent.state] ?? "var(--color-muted)";
  const src = agent.kind ? ICONS[agent.kind] : undefined;
  if (!src) return <Bot aria-hidden data-icon="agent" className="shrink-0" style={{ width: size, height: size, color }} />;
  return <span aria-hidden data-icon={agent.kind} className="flex shrink-0" style={{ width: size, height: size, color }} dangerouslySetInnerHTML={{ __html: src }} />;
}

/** The mark shows only while the agent works or waits (docs/design/recipe-herdr.md, Projects list). */
function Mark({ agent }: { agent: SidebarAgent }) {
  return agent.state === "working" || agent.state === "blocked" ? <StateMark state={agent.state} label={agent.state} /> : null;
}

function count(a: SidebarAgent): number {
  return a.workers.reduce((n, w) => n + 1 + count(w), 0);
}

function Worker({ agent, selected, depth, onSelect }: { agent: SidebarAgent; selected: string; depth: number; onSelect: (t: string) => void }) {
  const shown = agent.terminal === selected;
  const showName = agent.name && agent.name !== agent.title;
  return (
    <li>
      <button
        type="button"
        aria-current={shown || undefined}
        title={tip(agent) || agent.title}
        onClick={() => onSelect(agent.terminal)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex h-[26px] w-full items-center gap-2 rounded-md pr-2 text-left text-xs hover:bg-hover ${shown ? "bg-raised text-foreground" : agent.state === "done" ? "text-dim" : "text-muted"}`}
      >
        <AgentIcon agent={agent} size={13} />
        <span className="min-w-0 flex-1 truncate">{agent.title}</span>
        {showName && <span className="max-w-[72px] shrink truncate font-mono text-[10px] text-dim">{agent.name}</span>}
        <Mark agent={agent} />
      </button>
      {agent.workers.length > 0 && <Workers agents={agent.workers} selected={selected} depth={depth + 1} onSelect={onSelect} />}
    </li>
  );
}

function Workers({ agents, selected, depth, onSelect }: { agents: SidebarAgent[]; selected: string; depth: number; onSelect: (t: string) => void }) {
  return (
    <ul className={depth === 0 ? "ml-8 flex flex-col gap-0.5 border-l border-border py-1 pl-[9px]" : "flex flex-col gap-0.5"}>
      {agents.map((w) => <Worker key={w.terminal} agent={w} selected={selected} depth={depth} onSelect={onSelect} />)}
    </ul>
  );
}

function Agent({ agent, selected, since, onSelect }: { agent: SidebarAgent; selected: string; since: number | null; onSelect: (t: string) => void }) {
  const shown = agent.terminal === selected;
  const unread = !shown && agent.state === "done";
  const n = count(agent);
  return (
    <li>
      <button
        type="button"
        aria-current={shown || undefined}
        title={agent.title}
        onClick={() => onSelect(agent.terminal)}
        className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 pl-[26px] text-left text-[13px] ${shown ? "bg-raised font-medium text-foreground ring-1 ring-border" : unread ? "font-semibold text-foreground hover:bg-hover" : "text-muted hover:bg-hover"}`}
      >
        <span className="flex h-[18px] items-center self-start"><AgentIcon agent={agent} size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{agent.title}</span>
          {n > 0 && <span className="block text-xs font-normal text-muted">Orchestrating · {n} {n === 1 ? "worker" : "workers"}</span>}
        </span>
        {since !== null && agent.state !== "working" && (
          <span data-age className="shrink-0 self-start font-[Menlo,monospace] text-[11px] leading-[18px] font-normal text-muted">{duration(since)}</span>
        )}
        <Mark agent={agent} />
      </button>
      {n > 0 && <Workers agents={agent.workers} selected={selected} depth={0} onSelect={onSelect} />}
    </li>
  );
}

/** The head, the Projects list (one row per project, its agents under it, an orchestrator's workers under it) and the foot. */
export function Sidebar({ data, onSelect }: { data: SidebarData; onSelect: (terminal: string) => void }) {
  const [changes, setChanges] = useState<Changes>(load);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = Date.now();
    setNow(t);
    setChanges((prev) => {
      const next = track(prev, data.projects.flatMap((p) => p.agents), t);
      save(next);
      return next;
    });
  }, [data.projects]);
  // The ages count in minutes and have no event: draw them again each 30 s.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const age = useMemo(() => (terminal: string) => (changes[terminal] ? Math.max(0, now - changes[terminal].at) : null), [changes, now]);
  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-border bg-canvas">
    <Head />
    <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5">
      <h2 className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted">Projects</h2>
      {data.projects.map((p) => (
        <section key={p.name} aria-label={p.name} className="mb-2.5">
          <div className="flex h-[30px] items-center gap-1.5 px-2.5 text-[13px] font-medium text-muted">
            <Folder aria-hidden className="size-4 text-dim" />
            <span className="truncate">{p.name}</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {p.agents.map((a) => <Agent key={a.terminal} agent={a} selected={data.selected} since={age(a.terminal)} onSelect={onSelect} />)}
          </ul>
        </section>
      ))}
    </nav>
    <Foot />
    </aside>
  );
}
