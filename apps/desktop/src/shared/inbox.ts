import type { SidebarAgent, SidebarProject } from "./api";

/** The agents and workers that wait on a prompt (hc state `blocked`), in sidebar order. */
export function blockedAgents(projects: SidebarProject[]): SidebarAgent[] {
  const out: SidebarAgent[] = [];
  const walk = (a: SidebarAgent) => {
    if (a.state === "blocked") out.push(a);
    a.workers.forEach(walk);
  };
  projects.forEach((p) => p.agents.forEach(walk));
  return out;
}
