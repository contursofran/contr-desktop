import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const fixtures = path.join(e2e, "fixtures/sidebar-projects");

// #136: an agent shows under the project of its session folder (hc `get` `foreground.cwd`), not the folder it ran `cd` into,
// and each coordinator shows all its live workers, also one with no status yet.
test("agents show under their session's project, each coordinator with its live workers", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t81",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_LIST: path.join(fixtures, "hc.json"),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    FAKE_ORCH_LIST: path.join(fixtures, "orch.json"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    FAKE_GIT_BRANCH: "main",
  });
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Projects" });
  const region = (name: string) => nav.getByRole("region", { name });

  const farm = region("farm-game");
  const coordinator = farm.getByRole("button", { name: /Orchestrate the farm/ });
  await expect(coordinator).toHaveText(/Orchestrating · 3 workers/);
  for (const work of ["Walker path", "Gather art", "Plan the map"]) await expect(farm.getByRole("button", { name: work })).toBeVisible();
  await expect(farm.getByRole("listitem")).toHaveCount(4);

  const desk = region("desk-app");
  await expect(desk.getByRole("button", { name: /Tab styling/ })).toHaveText(/Orchestrating · 2 workers/);
  await expect(desk.getByRole("listitem")).toHaveCount(3);

  const tools = region("tools");
  await expect(tools.getByRole("listitem")).toHaveCount(1);
  await expect(tools.getByRole("listitem")).toContainText("Context not appearing");

  // The folders the agents ran `cd` into, and the shell's folder, are no projects.
  await expect(region("farm-web")).toHaveCount(0);
  await expect(nav.getByRole("region")).toHaveCount(3);
  await expect(page.getByLabel("Status")).toContainText("Orchestrating · 3 workers");

  const sidebar = page.locator("aside").first();
  await page.emulateMedia({ colorScheme: "dark" });
  await sidebar.screenshot({ path: path.join(shots, "sidebar-projects-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await sidebar.screenshot({ path: path.join(shots, "sidebar-projects-light.png") });
  await app.close();
});
