import type { SidebarAgent, SidebarProject } from "../../shared/api";

export interface ProjectTabs {
  order: string[];
  closed: string[];
}

export interface SavedTabs {
  projects: Record<string, ProjectTabs>;
  legacy: string[];
}

const KEY = "tabs.open";
const EMPTY: ProjectTabs = { order: [], closed: [] };
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id !== ""))] : [];

export function readTabs(): SavedTabs {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SavedTabs> | unknown[];
    if (Array.isArray(value)) return { projects: {}, legacy: strings(value) };
    const projects = Object.fromEntries(Object.entries(value?.projects ?? {}).flatMap(([key, entry]) =>
      entry && (key === "" || key.startsWith("project:"))
        ? [[key, { order: strings(entry.order), closed: strings(entry.closed) }]]
        : [],
    ));
    return { projects, legacy: strings(value?.legacy) };
  } catch {
    return { projects: {}, legacy: [] };
  }
}

export function saveTabs(tabs: SavedTabs): void {
  localStorage.setItem(KEY, JSON.stringify(tabs));
}

export function savedTerminals(tabs: SavedTabs): string[] {
  return [...new Set([...tabs.legacy, ...Object.values(tabs.projects).flatMap(({ order }) => order)])];
}

export const projectKey = (project: SidebarProject) => `project:${project.name}`;

interface TabMember {
  project: string;
  worker: boolean;
}

export function tabMembers(projects: SidebarProject[]): Map<string, TabMember> {
  const members = new Map<string, TabMember>();
  const add = (agent: SidebarAgent, project: string, worker: boolean) => {
    members.set(agent.terminal, { project, worker });
    for (const child of agent.workers) add(child, project, true);
  };
  for (const project of projects) {
    for (const agent of project.agents) add(agent, projectKey(project), false);
  }
  return members;
}

export function migrateTabs(tabs: SavedTabs, members: Map<string, TabMember>): SavedTabs {
  let next = tabs;
  const legacy = tabs.legacy.filter((id) => {
    const member = members.get(id);
    if (!member) return true;
    // A worker's tab comes from selection, even if an older version kept it open.
    if (!member.worker) next = editProject(next, member.project, (tab) => ({ ...tab, order: tab.order.includes(id) ? tab.order : [...tab.order, id] }));
    return false;
  });
  return legacy.length === tabs.legacy.length ? tabs : { ...next, legacy };
}

export function tabProject(tabs: SavedTabs, members: Map<string, TabMember>, terminal: string): string | undefined {
  return members.get(terminal)?.project
    ?? Object.keys(tabs.projects).find((key) => tabs.projects[key]!.order.includes(terminal))
    ?? (tabs.legacy.includes(terminal) ? "" : undefined);
}

export function visibleTabs(tabs: SavedTabs, members: Map<string, TabMember>, project: string, selected: string): string[] {
  const { order, closed } = tabs.projects[project] ?? EMPTY;
  const agents = [...members].flatMap(([id, member]) =>
    member.project === project && !member.worker ? [id] : [],
  );
  return [...new Set([...order, ...agents, ...(project === "" ? tabs.legacy : []), selected])].filter((id) => {
    if (!id) return false;
    if (id === selected) return true;
    const member = members.get(id);
    return !closed.includes(id) && (!member || (member.project === project && !member.worker));
  });
}

export function editProject(tabs: SavedTabs, project: string, edit: (tabs: ProjectTabs) => ProjectTabs): SavedTabs {
  const current = tabs.projects[project] ?? EMPTY;
  const next = edit(current);
  return next === current ? tabs : { ...tabs, projects: { ...tabs.projects, [project]: next } };
}

export function forgetTab(tabs: SavedTabs, id: string): SavedTabs {
  const projects = Object.fromEntries(Object.entries(tabs.projects).map(([key, tab]) =>
    [key, { ...tab, order: tab.order.filter((item) => item !== id) }],
  ));
  return { projects, legacy: tabs.legacy.filter((item) => item !== id) };
}
