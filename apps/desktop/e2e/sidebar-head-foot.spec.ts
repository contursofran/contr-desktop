import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("the sidebar head has the machine switch, the foot the plan usage and Settings", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  });
  const page = await app.firstWindow();
  const head = page.locator("aside > header");
  await expect(head).toContainText("contr");
  await expect(head.getByRole("button", { name: "Machine" })).toHaveText("This computer");
  const label = head.getByTestId("machine-label");
  expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await expect(head.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(head.getByRole("button", { name: "Hide sidebar" })).toBeVisible();

  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect(usage.getByRole("listitem")).toHaveText(["Claude64% wk · 4d", "Codex21% 5h · 3h"]);
  await expect(usage.getByRole("meter", { name: "Claude usage" })).toHaveAttribute("aria-valuenow", "64");
  await expect(page.locator("aside > footer").getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.locator("aside > footer").getByRole("button", { name: "Add machine" })).toBeVisible();

  await expect(page.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "sidebar-head-foot-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "sidebar-head-foot-light.png") });

  await app.close();
});
