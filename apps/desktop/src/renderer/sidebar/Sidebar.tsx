import { Folder } from "lucide-react";
import type { Sidebar as SidebarData, SidebarAgent } from "../../shared/api";
import { StateMark } from "../chat/blocks/Marks";

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
        title={agent.title}
        onClick={() => onSelect(agent.terminal)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`flex h-[26px] w-full items-center gap-2 rounded-md pr-2 text-left text-xs hover:bg-hover ${shown ? "bg-raised text-foreground" : agent.state === "done" ? "text-dim" : "text-muted"}`}
      >
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

function Agent({ agent, selected, onSelect }: { agent: SidebarAgent; selected: string; onSelect: (t: string) => void }) {
  const shown = agent.terminal === selected;
  const n = count(agent);
  return (
    <li>
      <button
        type="button"
        aria-current={shown || undefined}
        title={agent.title}
        onClick={() => onSelect(agent.terminal)}
        className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 pl-[26px] text-left text-[13px] ${shown ? "bg-raised font-medium text-foreground ring-1 ring-border" : "text-muted hover:bg-hover"}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{agent.title}</span>
          {n > 0 && <span className="block text-xs font-normal text-muted">Orchestrating · {n} {n === 1 ? "worker" : "workers"}</span>}
        </span>
        <Mark agent={agent} />
      </button>
      {n > 0 && <Workers agents={agent.workers} selected={selected} depth={0} onSelect={onSelect} />}
    </li>
  );
}

/** The Projects list: one row per project, its agents under it, an orchestrator's workers under the orchestrator. */
export function Sidebar({ data, onSelect }: { data: SidebarData; onSelect: (terminal: string) => void }) {
  return (
    <nav aria-label="Projects" className="flex w-[250px] shrink-0 flex-col overflow-y-auto border-r border-border bg-canvas px-2.5 pt-10">
      <h2 className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted">Projects</h2>
      {data.projects.map((p) => (
        <section key={p.name} aria-label={p.name} className="mb-2.5">
          <div className="flex h-[30px] items-center gap-1.5 px-2.5 text-[13px] font-medium text-muted">
            <Folder aria-hidden className="size-4 text-dim" />
            <span className="truncate">{p.name}</span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {p.agents.map((a) => <Agent key={a.terminal} agent={a} selected={data.selected} onSelect={onSelect} />)}
          </ul>
        </section>
      ))}
    </nav>
  );
}
