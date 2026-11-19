import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

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
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Release notes draft" }).click();

  // A tab click switches the chat as a sidebar click does.
  await tabs.getByRole("tab", { name: "Chat panel usability audit" }).click();
  await expect(tabs.getByRole("tab", { name: "Chat panel usability audit" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  // The Chat / Terminal switch still works.
  const sw = page.getByRole("radiogroup", { name: "Chat or Terminal" });
  await sw.getByRole("radio", { name: "Terminal" }).click();
  await expect(sw.getByRole("radio", { name: "Terminal" })).toBeChecked();
  await sw.getByRole("radio", { name: "Chat" }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  // × closes the shown tab and shows the next one.
  await tabs.getByRole("button", { name: "Close Chat panel usability audit" }).click();
  await expect(tabs.getByRole("tab")).toHaveText(["Install health check", "Release notes draft"]);
  await expect(page.getByRole("textbox", { name: "Reply to Install health check" })).toBeVisible();
  await app.close();
});

for (const [name, env, label] of [
  ["its hc title", {}, "Chat panel usability audit"],
  ["the program name", { FAKE_HC_TITLE: "" }, "Claude Code"],
] as const) {
  test(`a tab with no sidebar entry shows ${name}, never the terminal id`, async () => {
    const app = await launchApp({
      CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
      FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
      CONTR_TERMINAL: "t7",
      CONTR_HC: path.join(e2e, "fake-hc.mjs"),
      CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
      CONTR_GIT: path.join(e2e, "fake-git.mjs"),
      ...env,
    });
    const page = await app.firstWindow();
    const tabs = page.getByRole("tablist", { name: "Tabs" });
    await expect(tabs.getByRole("tab")).toHaveText([label]);
    await app.close();
  });
}

test("a tab moves by drag and by Alt with the arrows, the order stays after a restart, and a gone terminal's tab does not", async () => {
  test.setTimeout(60_000);
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  const env = {
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  };
  const [a, b] = ["Chat panel usability audit", "Install health check"];
  let app = await launchApp(env, dataDir);
  let page = await app.firstWindow();
  let tabs = page.getByRole("tablist", { name: "Tabs" });
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: b }).click();
  await expect(tabs.getByRole("tab")).toHaveText([a, b]);

  // A pointer drag of the second tab over the first moves it there.
  const from = (await tabs.getByRole("tab", { name: b }).boundingBox())!;
  const to = (await tabs.getByRole("tab", { name: a }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);

  // Alt with Right moves the focused tab one place; Alt with Home moves it first.
  await tabs.getByRole("tab", { name: b }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(tabs.getByRole("tab")).toHaveText([a, b]);
  await page.keyboard.press("Alt+Home");
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);
  await tabs.getByRole("tab", { name: a }).focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(tabs.getByRole("tab")).toHaveText([a, b]);
  await page.keyboard.press("Alt+End");
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);
  // The shown agent is stored too (`tabs.shown`), and a start shows it again while hc lists it, with its tab. With b
  // shown here, the last start below opens b's tab again some time after it starts (issue #159): a shows instead.
  await tabs.getByRole("tab", { name: a }).click();
  await expect(tabs.getByRole("tab", { name: a })).toHaveAttribute("aria-selected", "true");
  await app.close();

  app = await launchApp(env, dataDir);
  page = await app.firstWindow();
  tabs = page.getByRole("tablist", { name: "Tabs" });
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);
  await app.close();

  // A saved tab whose terminal hc no longer lists does not open again.
  app = await launchApp({ ...env, FAKE_HC_AGENTS: "0", FAKE_HC_GONE: "t12" }, dataDir);
  page = await app.firstWindow();
  tabs = page.getByRole("tablist", { name: "Tabs" });
  await expect(tabs.getByRole("tab")).toHaveText([a]);
  await app.close();
  app = await launchApp(env, dataDir);
  page = await app.firstWindow();
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab")).toHaveText([a]);
  await app.close();
});
