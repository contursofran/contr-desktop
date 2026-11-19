import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import { css, selectable, shot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";
import type { SidebarAgent, SidebarProject } from "../shared/api";

const agent = (terminal: string, title: string): SidebarAgent => ({
  terminal, title, kind: "claude-code", name: null, state: "working", issue: null, workers: [],
});
const project = (name: string, agent: SidebarAgent): SidebarProject => ({
  name, cwd: `/work/${name}`, branch: "main", ahead: 0, behind: 0, favicon: null, agents: [agent],
});

test("each project shows its agents and each coordinator shows its workers", async () => {
  const farmAgent = agent("t81", "Orchestrate the farm");
  farmAgent.workers = [agent("t9k", "Walker path"), agent("t9m", "Gather art"), agent("t9n", "Plan the map")];
  const deskAgent = agent("t7k", "Tab styling");
  deskAgent.workers = [agent("t97", "Restart state"), agent("t9h", "Small texts")];
  await renderApp(transcript, null, selectable({
    selected: "t81",
    projects: [
      project("farm-game", farmAgent),
      project("desk-app", deskAgent),
      project("tools", agent("t5b", "Context not appearing")),
    ],
  }).overrides);
  const nav = page.getByRole("navigation", { name: "Projects" });
  const region = (name: string) => nav.getByRole("region", { name });

  const farm = region("farm-game");
  const coordinator = farm.getByRole("button", { name: /Orchestrate the farm/ });
  await expect.poll(() => coordinator.query()?.textContent).toMatch(/Orchestrating · 3 workers/);
  for (const work of ["Walker path", "Gather art", "Plan the map"]) await expect.element(farm.getByRole("button", { name: work, exact: false })).toBeVisible();
  await expect.poll(() => farm.getByRole("listitem").elements().length).toBe(4);

  const desk = region("desk-app");
  await expect.poll(() => desk.getByRole("button", { name: /Tab styling/ }).query()?.textContent).toMatch(/Orchestrating · 2 workers/);
  await expect.poll(() => desk.getByRole("listitem").elements().length).toBe(3);

  const tools = region("tools");
  await expect.poll(() => tools.getByRole("listitem").elements().length).toBe(1);
  await expect.poll(() => tools.getByRole("listitem").element().textContent).toContain("Context not appearing");

  // The folders the agents ran `cd` into, and the shell's folder, are no projects.
  await expect.poll(() => region("farm-web").elements().length).toBe(0);
  await expect.poll(() => nav.getByRole("region").elements().length).toBe(3);
  await expect.poll(() => page.getByLabelText("Status").element().textContent).toContain("Orchestrating · 3 workers");

  const sidebar = page.elementLocator(css("aside"));
  await commands.colorScheme("dark");
  await shot("sidebar-projects-dark", sidebar);
  await commands.colorScheme("light");
  await shot("sidebar-projects-light", sidebar);
});
