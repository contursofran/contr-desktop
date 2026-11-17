import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("the sidebar lists projects, agents and workers, and a click switches the chat", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: log,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    FAKE_GIT_BRANCH: "main",
    FAKE_GIT_COUNTS: "2\t4",
  });
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Projects" });
  const desktop = nav.getByRole("region", { name: "contr-desktop" });
  await expect(desktop.getByRole("listitem")).toHaveCount(5);
  // #45: the project row has its branch, the commits ahead and behind from git, and the folder (the fake folder has no favicon).
  await expect(desktop.locator("[data-branch]")).toHaveText("main");
  await expect(desktop.locator("[data-ahead]")).toHaveText("↑2");
  await expect(desktop.locator("[data-behind]")).toHaveText("↓4");
  await expect(desktop.locator('[data-icon="folder"]')).toHaveCount(1);
  await expect(desktop.getByRole("button", { name: /Chat panel usability audit/ })).toHaveText(/Orchestrating · 3 workers/);
  await expect(desktop.getByRole("button", { name: /Chat panel usability audit/ })).toHaveAttribute("aria-current", "true");
  await expect(desktop.getByRole("button", { name: /Flow and sequence diagrams/ })).toContainText("b-30");
  const flow = desktop.getByRole("button", { name: /Flow and sequence diagrams/ });
  await expect(flow).toHaveAccessibleDescription("b-30 · #30 · Flow and sequence diagrams");
  await expect(flow.locator("[data-icon]")).toHaveAttribute("data-icon", "claude-code");
  await expect(desktop.getByRole("button", { name: /Virtual list/ })).toHaveAccessibleDescription("b-50 · Virtual list");
  const notes = desktop.getByRole("button", { name: /Release notes draft/ });
  await expect(notes.locator("[data-age]")).toHaveText("<1m");
  await expect(notes).toHaveCSS("font-weight", "600");
  await expect(desktop.getByRole("button", { name: /Chat panel usability audit/ }).locator("[data-age]")).toHaveCount(0);
  const herdr = nav.getByRole("region", { name: "herdr-contr" });
  await expect(herdr.getByRole("listitem")).toHaveCount(1);
  await expect(herdr.getByRole("listitem")).toContainText("Install health check");
  await expect(herdr.getByRole("listitem").locator("[data-icon]")).toHaveAttribute("data-icon", "codex");
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  // #57: the status line counts the same workers as the rows under the agent (t7: three; the 5 rows hold t7, t11 and its 3 workers).
  await expect(page.getByLabel("Status")).toContainText("Orchestrating · 3 workers");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "sidebar-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "sidebar-light.png") });

  await herdr.getByRole("button", { name: "Install health check" }).click();
  await expect(herdr.getByRole("button", { name: "Install health check" })).toHaveAttribute("aria-current", "true");
  await expect(notes).toHaveCSS("font-weight", "600");
  // #57: the tool lists a live b-30 under t12 with no hc terminal: no worker row and no worker count.
  await expect(herdr.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Status")).not.toContainText("Orchestrating");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "worker-count-dark.png") });
  const box = page.getByRole("textbox", { name: "Reply to Install health check" });
  await box.fill("hello");
  await box.press("Enter");
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(log, "utf8"))).toEqual({ terminal: "t12", text: "hello" });

  // #45: the chevron shuts a project; its agents' marks show on its row, and a reload keeps it shut.
  await desktop.getByRole("button", { name: "Shut contr-desktop" }).click();
  await expect(desktop.getByRole("listitem")).toHaveCount(0);
  await expect(desktop.locator("[data-state]")).toHaveCount(2);
  const name = desktop.locator("[data-name]");
  await expect(name).toHaveText("contr-desktop");
  expect(await name.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  // The branch has no room on the shut row: it hides (it is on the hidden second line), not a cut piece.
  expect(await desktop.locator("[data-branch]").evaluate((e) => e.getBoundingClientRect().top >= e.parentElement!.getBoundingClientRect().bottom)).toBe(true);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "project-shut-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "project-shut-light.png") });
  await page.reload();
  await expect(desktop.getByRole("button", { name: "Open contr-desktop" })).toHaveAttribute("aria-expanded", "false");
  await expect(desktop.getByRole("listitem")).toHaveCount(0);
  await desktop.getByRole("button", { name: "Open contr-desktop" }).click();
  await expect(desktop.getByRole("listitem")).toHaveCount(5);
  await app.close();
});

test("a worker's chat: the reply box names it as its tab does, and the chat, model, context and status line are its own (#90)", async () => {
  test.setTimeout(60_000);
  // b-40 (t9) waits on a permission prompt.
  const status = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "status.json");
  writeFileSync(status, JSON.stringify({ t9: "blocked" }));
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HC_STATUS: status,
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    FAKE_GIT_BRANCH: "agent/40-cards",
  });
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });

  // hc names the terminal b-40 and gives no title: the tab, the sidebar and the reply box all show the tool's title.
  await nav.getByRole("button", { name: /Cards for prompts and questions/ }).click();
  await expect(tabs.getByRole("tab", { name: "Cards for prompts and questions" })).toHaveAttribute("aria-selected", "true");
  const box = page.getByRole("textbox", { name: "Reply to Cards for prompts and questions" });
  await expect(box).toHaveAttribute("placeholder", "Reply to Cards for prompts and questions");
  const chat = page.getByRole("list", { name: "Chat" });
  await expect(chat).toContainText('Issue #40 of contr-desktop: "Cards for prompts and questions"');
  await expect(chat).toContainText("Unit tests pass. Now the e2e test for the cards.");
  await expect(page.getByRole("button", { name: "Model" })).toHaveText("Opus 5.5high");
  await expect(page.getByLabel("Context 58%")).toHaveText("58%");
  // The card comes on the same tick after the working line: once it shows, the status line has had b-40's answer.
  await expect(page.getByRole("region", { name: "Approval" })).toBeVisible();
  await expect(page.getByLabel("Status").getByRole("status")).toHaveCount(0);
  await expect(page.getByLabel("Status")).not.toContainText("Hashing");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `worker-chat-${scheme}.png`) });
  }

  // b-30 (t8) works: its own working line, model and effort.
  await nav.getByRole("button", { name: /Flow and sequence diagrams/ }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Flow and sequence diagrams" })).toBeVisible();
  await expect(page.getByLabel("Status")).toContainText("Drawing…");
  await expect(page.getByRole("button", { name: "Model" })).toHaveText("Sonnet 5high");
  await expect(page.getByLabel("Context 22%")).toHaveText("22%");
  await app.close();
});
