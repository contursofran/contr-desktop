import { Bot, ChevronDown, ChevronRight, Folder, Inbox } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Sidebar as SidebarData, SidebarAgent, SidebarProject } from "../../shared/api";
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

/** The shut projects, by name, kept in localStorage `projects.closed` (as herdr-contr). */
const CLOSED_KEY = "projects.closed";
function loadClosed(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function contains(agents: SidebarAgent[], terminal: string): boolean {
  return agents.some((a) => a.terminal === terminal || contains(a.workers, terminal));
}

/** A project row (docs/design/recipe-herdr.md, Projects list): chevron, favicon or folder, name, branch, and the commits ahead and behind. */
function ProjectRow({ project, shown, closed, onToggle }: { project: SidebarProject; shown: boolean; closed: boolean; onToggle: () => void }) {
  const Chevron = closed ? ChevronRight : ChevronDown;
  return (
    <div className="flex h-[30px] items-center gap-1.5 overflow-hidden rounded-lg pr-2.5 pl-1.5 text-[13px]">
      <button type="button" aria-label={`${closed ? "Open" : "Shut"} ${project.name}`} aria-expanded={!closed} onClick={onToggle} className="flex shrink-0 text-dim hover:text-muted">
        <Chevron aria-hidden className="size-[14px]" />
      </button>
      {project.favicon ? (
        <img data-icon="favicon" src={project.favicon} alt="" className="size-4 shrink-0 rounded opacity-70" />
      ) : (
        <Folder data-icon="folder" aria-hidden className="size-4 shrink-0 text-dim" />
      )}
      {/* The name reads in full: the branch shrinks first (to nothing), then the marks, then the counts; the name truncates last. */}
      <span data-name className={`max-w-full shrink-[0.001] truncate font-medium ${shown ? "text-foreground" : "text-muted"}`}>{project.name}</span>
      {/* A branch with no room wraps to a second line that the 16 px box hides. */}
      {project.branch && (
        <span className="flex h-4 min-w-0 shrink-[1000] flex-wrap overflow-hidden">
          <span className="h-4 w-0" />
          <span data-branch className="font-[Menlo,monospace] text-[11px] leading-4 whitespace-nowrap text-muted">{project.branch}</span>
        </span>
      )}
      <span className="min-w-0 flex-1" />
      {closed && <span className="flex min-w-0 shrink-[100] overflow-hidden">{project.agents.map((a) => <span key={a.terminal} className="flex shrink-0 scale-[0.93]"><StateMark state={a.state} label={`${a.title}: ${a.state}`} /></span>)}</span>}
      {(project.ahead > 0 || project.behind > 0) && (
        <span className="flex min-w-0 shrink-[10] gap-1.5 overflow-hidden font-[Menlo,monospace] text-[11px] whitespace-nowrap text-muted">
          {project.ahead > 0 && <span data-ahead>↑{project.ahead}</span>}
          {project.behind > 0 && <span data-behind>↓{project.behind}</span>}
        </span>
      )}
    </div>
  );
}

/** The Inbox row above Projects (D95): "Inbox · N", quiet with no count when nothing is open. Selected as an agent row is. */
function InboxRow({ count, shown, onOpen }: { count: number; shown: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-current={shown || undefined}
      onClick={onOpen}
      className={`mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${shown ? "bg-raised font-medium text-foreground ring-1 ring-border" : count > 0 ? "font-semibold text-foreground hover:bg-hover" : "text-muted hover:bg-hover"}`}
    >
      <Inbox aria-hidden className="size-[15px] shrink-0" />
      <span>{count > 0 ? `Inbox · ${count}` : "Inbox"}</span>
    </button>
  );
}

/** The head, the Inbox row, the Projects list (one row per project, its agents under it, an orchestrator's workers under it) and the foot. */
export function Sidebar({ data, onSelect, inbox, inboxShown, onInbox, onSettings, settingsShown }: { data: SidebarData; onSelect: (terminal: string) => void; inbox: number; inboxShown: boolean; onInbox: () => void; onSettings: () => void; settingsShown: boolean }) {
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
  const [closed, setClosed] = useState(loadClosed);
  const toggle = (name: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
      return next;
    });
  const age = useMemo(() => (terminal: string) => (changes[terminal] ? Math.max(0, now - changes[terminal].at) : null), [changes, now]);
  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-border bg-canvas">
    <Head />
    <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5">
      <InboxRow count={inbox} shown={inboxShown} onOpen={onInbox} />
      <h2 className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted">Projects</h2>
      {data.projects.map((p) => (
        <section key={p.name} aria-label={p.name} className="mb-2.5">
          <ProjectRow project={p} shown={contains(p.agents, data.selected)} closed={closed.has(p.name)} onToggle={() => toggle(p.name)} />
          {!closed.has(p.name) && (
            <ul className="flex flex-col gap-0.5">
              {p.agents.map((a) => <Agent key={a.terminal} agent={a} selected={inboxShown ? "" : data.selected} since={age(a.terminal)} onSelect={onSelect} />)}
            </ul>
          )}
        </section>
      ))}
    </nav>
    <Foot onSettings={onSettings} settingsShown={settingsShown} />
    </aside>
  );
}
