import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
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
  });
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Projects" });
  const desktop = nav.getByRole("region", { name: "contr-desktop" });
  await expect(desktop.getByRole("button")).toHaveCount(5);
  await expect(desktop.getByRole("button", { name: /Chat panel usability audit/ })).toHaveText(/Orchestrating · 3 workers/);
  await expect(desktop.getByRole("button", { name: /Chat panel usability audit/ })).toHaveAttribute("aria-current", "true");
  await expect(desktop.getByRole("button", { name: /Flow and sequence diagrams/ })).toContainText("b-30");
  await expect(desktop.getByRole("button", { name: /Release notes draft/ })).toBeVisible();
  const herdr = nav.getByRole("region", { name: "herdr-contr" });
  await expect(herdr.getByRole("button")).toHaveCount(1);
  await expect(herdr.getByRole("button")).toContainText("Install health check");
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  // #57: the status line counts the same workers as the rows under the agent (t7: three; the 5 rows hold t7, t11 and its 3 workers).
  await expect(page.getByLabel("Status")).toContainText("Orchestrating · 3 workers");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "sidebar-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "sidebar-light.png") });

  await herdr.getByRole("button", { name: "Install health check" }).click();
  await expect(herdr.getByRole("button", { name: "Install health check" })).toHaveAttribute("aria-current", "true");
  // #57: the tool lists a live b-30 under t12 with no hc terminal: no worker row and no worker count.
  await expect(herdr.getByRole("button")).toHaveCount(1);
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Status")).not.toContainText("Orchestrating");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "worker-count-dark.png") });
  const box = page.getByRole("textbox", { name: "Reply to Install health check" });
  await box.fill("hello");
  await box.press("Enter");
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(log, "utf8"))).toEqual({ terminal: "t12", text: "hello" });
  await app.close();
});
