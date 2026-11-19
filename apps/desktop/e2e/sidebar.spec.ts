import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

test("git counts reach the sidebar, sends go to the selected agent and a project stays shut on reload", async () => {
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
  // The project row shows git branch and counts from main.
  await expect(desktop.locator("[data-branch]")).toHaveText("main");
  await expect(desktop.locator("[data-ahead]")).toHaveText("↑2");
  await expect(desktop.locator("[data-behind]")).toHaveText("↓4");
  const herdr = nav.getByRole("region", { name: "herdr-contr" });
  // An orchestration worker has no hc terminal under t12, so it has no row or status count.
  await herdr.getByRole("button", { name: "Install health check" }).click();
  await expect(herdr.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByLabel("Status")).not.toContainText("Orchestrating");
  const box = page.getByRole("textbox", { name: "Reply to Install health check" });
  await box.fill("hello");
  await box.press("Enter");
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(log, "utf8"))).toEqual({ terminal: "t12", text: "hello" });

  // #45: the chevron shuts a project; its agents' marks show on its row, and a reload keeps it shut.
  await desktop.getByRole("button", { name: "Shut contr-desktop" }).click();
  await page.reload();
  await expect(desktop.getByRole("button", { name: "Open contr-desktop" })).toHaveAttribute("aria-expanded", "false");
  await expect(desktop.getByRole("listitem")).toHaveCount(0);
  await desktop.getByRole("button", { name: "Open contr-desktop" }).click();
  await expect(desktop.getByRole("listitem")).toHaveCount(5);
  await app.close();
});

test("selecting a worker starts its own feed and reads its reply info", async () => {
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
  await nav.getByRole("button", { name: /Cards for prompts and questions/ }).click();
  const chat = page.getByRole("list", { name: "Chat" });
  await expect(chat).toContainText('Issue #40 of contr-desktop: "Cards for prompts and questions"');
  await expect(chat).toContainText("Unit tests pass. Now the e2e test for the cards.");
  // b-30 (t8) works: its own working line, model and effort.
  await nav.getByRole("button", { name: /Flow and sequence diagrams/ }).click();
  await expect(page.getByLabel("Status")).toContainText("Drawing…");
  await expect(page.getByRole("button", { name: "Model" })).toHaveText("Sonnet 5high");
  await expect(page.getByLabel("Context 22%")).toHaveText("22%");
  await app.close();
});
