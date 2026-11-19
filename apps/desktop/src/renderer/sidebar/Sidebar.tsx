import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Folder, Inbox, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Sidebar as SidebarData, SidebarAgent, SidebarProject } from "../../shared/api";
import { StateMark } from "../chat/blocks/Marks";
import { Foot } from "./Foot";
import { Head } from "./Head";
import { Tip } from "../ui/Tip";
import { type Changes, duration, load, save, tip, track } from "./ages";
import { AgentIcon as ProgramIcon } from "../ui/AgentIcon";
import { StatusGlyph } from "../ui/StatusGlyph";

const TINT: Record<string, string> = { working: "var(--color-working)", done: "var(--color-done)", blocked: "var(--color-blocked)" };

/** Projects and their agents in sidebar order, with each worker after its parent. */
export function adjacentAgent({ projects, selected }: SidebarData, step: -1 | 1): string | undefined {
  const ordered = (agent: SidebarAgent): string[] => [agent.terminal, ...agent.workers.flatMap(ordered)];
  const terminals = projects.flatMap((project) => project.agents.flatMap(ordered));
  const index = terminals.indexOf(selected);
  return index < 0 ? undefined : terminals[index + step];
}

/** The program picture or a one-color glyph in the agent state's ink. */
function AgentIcon({ agent, size }: { agent: SidebarAgent; size: number }) {
  return (
    <span className="sidebar-program-icon flex shrink-0">
      <ProgramIcon kind={agent.kind} size={size} color={TINT[agent.state] ?? "var(--color-muted)"} />
    </span>
  );
}

/**
 * The status glyph (docs/design/redesign, sidebar): working ⠋, idle ⠶ in ink-42, blocked ⠿ in red.
 * A done agent outside the shown chat has an ink-100 unread dot (#246, D144 and D145).
 * hc and the orchestration tool map their `waiting` state to blocked.
 */
function Mark({ agent, shown }: { agent: SidebarAgent; shown: boolean }) {
  if (agent.state !== "done") return <StatusGlyph state={agent.state} />;
  if (shown) return null;
  return (
    <span role="img" aria-label="unread" className="flex w-3.5 shrink-0 justify-center">
      <span className="size-1 rounded-full bg-ink-100" />
    </span>
  );
}

function count(a: SidebarAgent): number {
  return a.workers.reduce((n, w) => n + 1 + count(w), 0);
}

/** The selected row: Herdr's grey fill with a faint inset line, and full ink (owner, 2026-11-18, #179). */
const SELECTED = "bg-selected shadow-[var(--shadow-selected)] text-ink-100";

function Worker({ agent, selected, depth, onSelect }: { agent: SidebarAgent; selected: string; depth: number; onSelect: (t: string) => void }) {
  const shown = agent.terminal === selected;
  const asks = agent.state === "blocked";
  const showName = agent.name && agent.name !== agent.title;
  return (
    <li>
      <Tip label={tip(agent) || agent.title} side="right">
        <button
          type="button"
          aria-current={shown || undefined}
          onClick={() => onSelect(agent.terminal)}
          style={{ paddingLeft: 6 + depth * 14 }}
          className={`flex h-7 w-full items-center gap-2 rounded-[7px] pr-2.5 text-left text-[12.5px] ${shown ? SELECTED : `hover:bg-hover ${asks ? "text-ink-100" : "text-dim"}`}`}
        >
          <AgentIcon agent={agent} size={13} />
          <span className="min-w-0 flex-1 truncate">{agent.title}</span>
          {showName && <span className={`max-w-[72px] shrink truncate font-mono text-[11px] ${asks || shown ? "text-muted" : "text-dim"}`}>{agent.name}</span>}
          <Mark agent={agent} shown={shown} />
        </button>
      </Tip>
      {agent.workers.length > 0 && <Workers agents={agent.workers} selected={selected} depth={depth + 1} onSelect={onSelect} />}
    </li>
  );
}

function Workers({ agents, selected, depth, onSelect }: { agents: SidebarAgent[]; selected: string; depth: number; onSelect: (t: string) => void }) {
  return (
    <ul className={depth === 0 ? "ml-[34px] flex flex-col border-l border-rail pl-[9px]" : "flex flex-col"}>
      {agents.map((w) => <Worker key={w.terminal} agent={w} selected={selected} depth={depth} onSelect={onSelect} />)}
    </ul>
  );
}

function Agent({ agent, selected, since, onSelect }: { agent: SidebarAgent; selected: string; since: number | null; onSelect: (t: string) => void }) {
  const shown = agent.terminal === selected;
  const n = count(agent);
  return (
    <li>
      <Tip label={agent.title} side="right">
        <button
          type="button"
          aria-current={shown || undefined}
          onClick={() => onSelect(agent.terminal)}
          className={`flex w-full items-start gap-2.5 rounded-lg py-1.5 pr-2.5 pl-[26px] text-left text-[13px] leading-[18px] ${shown ? SELECTED : "text-ink-60 hover:bg-hover"}`}
        >
          <span className="flex h-[18px] items-center"><AgentIcon agent={agent} size={15} /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate">{agent.title}</span>
            {n > 0 && <span className={`text-[11.5px] leading-4 font-normal ${shown ? "text-muted" : "text-dim"}`}>Orchestrating · {n} {n === 1 ? "worker" : "workers"}</span>}
          </span>
          {since !== null && agent.state !== "working" && agent.state !== "blocked" && (
            <span data-age className="shrink-0 font-mono text-[11px] font-normal text-dim">{duration(since)}</span>
          )}
          <span className="flex h-[18px] items-center"><Mark agent={agent} shown={shown} /></span>
        </button>
      </Tip>
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

/** A project row (docs/design/redesign, sidebar): chevron, favicon or folder, name, mono branch, and the commits ahead and behind. */
function ProjectRow({ project, closed }: { project: SidebarProject; closed: boolean }) {
  return (
    <div className="mt-1.5 flex h-[30px] items-center gap-2 overflow-hidden rounded-lg pr-2.5 pl-2 text-[13px]">
      <CollapsibleTrigger aria-label={`${closed ? "Expand" : "Collapse"} ${project.name}`} className="flex w-2.5 shrink-0 justify-center text-[9px] text-ink-42 hover:text-muted">
        {/* The mock's text chevron. U+FE0E keeps ▶ a text glyph, not an emoji. */}
        <span aria-hidden>{closed ? "▶\uFE0E" : "▼"}</span>
      </CollapsibleTrigger>
      {project.favicon ? (
        <img data-icon="favicon" src={project.favicon} alt="" className="size-[15px] shrink-0 rounded opacity-70" />
      ) : (
        <Folder data-icon="folder" aria-hidden strokeWidth={1.6} className="size-[15px] shrink-0 text-dim" />
      )}
      {/* The name reads in full: the branch shrinks first (to nothing), then the marks, then the counts; the name truncates last. */}
      {/* Its tooltip has the whole name. */}
      <Tip label={project.name} side="right">
        <span data-name className="max-w-full shrink-[0.001] truncate font-medium text-ink-85">{project.name}</span>
      </Tip>
      {/* A branch with no room wraps to a second line that the 16 px box hides. */}
      {project.branch && (
        <span className="flex h-4 min-w-0 shrink-[1000] flex-wrap overflow-hidden">
          <span className="h-4 w-0" />
          <span data-branch className="font-mono text-[11px] leading-4 whitespace-nowrap text-dim">{project.branch}</span>
        </span>
      )}
      <span className="min-w-0 flex-1" />
      {closed && <span className="flex min-w-0 shrink-[100] overflow-hidden">{project.agents.map((a) => <span key={a.terminal} className="flex shrink-0 scale-[0.93]"><StateMark state={a.state} label={`${a.title}: ${a.state}`} /></span>)}</span>}
      {(project.ahead > 0 || project.behind > 0) && (
        <span className="flex min-w-0 shrink-[10] gap-1.5 overflow-hidden font-mono text-[11px] whitespace-nowrap text-dim">
          {project.ahead > 0 && <span data-ahead>↑{project.ahead}</span>}
          {project.behind > 0 && <span data-behind>↓{project.behind}</span>}
        </span>
      )}
    </div>
  );
}

/** The Inbox row above Projects (D95): "Inbox" and the open count in mono, no count when nothing is open. Selected as an agent row is. */
function InboxRow({ count, shown, onOpen }: { count: number; shown: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-current={shown || undefined}
      aria-label={count > 0 ? `Inbox, ${count} open` : "Inbox"}
      onClick={onOpen}
      className={`mt-0.5 flex h-[30px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] ${shown ? SELECTED : "text-ink-85 hover:bg-hover"}`}
    >
      <Inbox aria-hidden strokeWidth={1.6} className="size-[15px] shrink-0 text-muted" />
      <span className="flex-1">Inbox</span>
      {count > 0 && <span data-count className="font-mono text-[11px] font-medium text-ink-100">{count}</span>}
    </button>
  );
}

const HIDDEN_KEY = "sidebar.hidden";

/** Whether the owner hid the sidebar, kept in localStorage `sidebar.hidden` over restarts, as the open tabs are. */
export function readHidden(): boolean {
  return localStorage.getItem(HIDDEN_KEY) === "true";
}

export function saveHidden(hidden: boolean): void {
  localStorage.setItem(HIDDEN_KEY, String(hidden));
}

/** The head, the Inbox row, the Projects list (one row per project, its agents under it, an orchestrator's workers under it) and the foot. */
export function Sidebar({ data, onSelect, inbox, inboxShown, onInbox, onSettings, settingsShown, onHide }: { data: SidebarData; onSelect: (terminal: string) => void; inbox: number; inboxShown: boolean; onInbox: () => void; onSettings: () => void; settingsShown: boolean; onHide: () => void }) {
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
    <aside className="flex w-[268px] shrink-0 flex-col border-r border-hairline bg-chrome">
    <Head onHide={onHide} />
    <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
      <InboxRow count={inbox} shown={inboxShown} onOpen={onInbox} />
      <div className="mt-1.5 flex h-[34px] items-center pr-0 pl-2.5">
        <h2 className="flex-1 text-xs font-medium text-dim">Projects</h2>
        {/* Add project does nothing yet. */}
        <Tip label="Add project (not yet)" side="right">
          <button type="button" aria-label="Add project" aria-disabled="true" tabIndex={-1} className="flex size-[26px] items-center justify-center rounded-lg text-dim">
            <Plus aria-hidden strokeWidth={1.6} className="size-3.5" />
          </button>
        </Tip>
      </div>
      {/* 12 px `muted`, as the design's "N more projects, no agents" row. With hc down the list is unknown, not empty. */}
      {data.projects.length === 0 && <p className="px-2.5 py-1 text-xs text-muted">{data.hcError ? "hc is not reachable" : "No agents"}</p>}
      {data.projects.map((p) => (
        <Collapsible key={p.name} open={!closed.has(p.name)} onOpenChange={() => toggle(p.name)} render={<section aria-label={p.name} className="mb-1.5 flex flex-col gap-px" />}>
          <ProjectRow project={p} closed={closed.has(p.name)} />
          <CollapsiblePanel>
            <ul className="flex flex-col gap-px">
              {p.agents.map((a) => <Agent key={a.terminal} agent={a} selected={data.selected} since={age(a.terminal)} onSelect={onSelect} />)}
            </ul>
          </CollapsiblePanel>
        </Collapsible>
      ))}
    </nav>
    <Foot onSettings={onSettings} settingsShown={settingsShown} />
    </aside>
  );
}
