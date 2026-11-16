import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("the top bar has one tab per opened agent, and a tab click switches the chat", async () => {
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
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  await expect(tabs.getByRole("tab")).toHaveText(["Chat panel usability audit"]);

  // A sidebar click opens a second tab and selects it.
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Install health check" }).click();
  await expect(tabs.getByRole("tab")).toHaveText(["Chat panel usability audit", "Install health check"]);
  await expect(tabs.getByRole("tab", { name: "Install health check" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Reply to Install health check" })).toBeVisible();
  await expect(tabs.getByRole("button", { name: "New tab" })).toBeDisabled();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "topbar-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "topbar-light.png") });

  // A tab click switches the chat as a sidebar click does.
  await tabs.getByRole("tab", { name: "Chat panel usability audit" }).click();
  await expect(tabs.getByRole("tab", { name: "Chat panel usability audit" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  // The Chat / Terminal switch still works.
  const sw = page.getByRole("group", { name: "Chat or Terminal" });
  await sw.getByRole("button", { name: "Terminal" }).click();
  await expect(sw.getByRole("button", { name: "Terminal" })).toHaveAttribute("aria-pressed", "true");
  await sw.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  // × closes the shown tab and shows the next one.
  await tabs.getByRole("button", { name: "Close Chat panel usability audit" }).click();
  await expect(tabs.getByRole("tab")).toHaveText(["Install health check"]);
  await expect(page.getByRole("textbox", { name: "Reply to Install health check" })).toBeVisible();
  await app.close();
});
