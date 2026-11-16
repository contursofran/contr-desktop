import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
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
  // A third tab, then the second one shown again: three tabs, one shown.
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Release notes draft" }).click();
  await tabs.getByRole("tab", { name: "Install health check" }).click();
  const names = ["Chat panel usability audit", "Install health check", "Release notes draft"];
  await expect(tabs.getByRole("tab")).toHaveText(names);
  // All titles fit: the tabs grow, nothing is cut.
  for (const name of names) {
    const label = tabs.getByRole("tab", { name }).locator("span");
    expect(await label.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  }
  // Herdr's normal tabs: from the left of the bar, 3 px apart, 29 px tall, 7 px corners; only the shown tab has a × and a fill.
  await expect(tabs.locator("[data-tab-close]")).toHaveCount(1);
  await expect(tabs.getByRole("button", { name: "Close Install health check" })).toBeVisible();
  const box = async (name: string) => (await tabs.getByRole("tab", { name }).locator("..").boundingBox())!;
  const [first, second] = [await box(names[0]), await box(names[1])];
  expect(first.height).toBe(29);
  expect(first.x - (await tabs.locator("..").boundingBox())!.x).toBe(10);
  expect(Math.round(second.x - (first.x + first.width))).toBe(3);
  const style = (name: string) => tabs.getByRole("tab", { name }).locator("..").evaluate((e) => {
    const s = getComputedStyle(e);
    return { radius: s.borderTopLeftRadius, font: s.fontSize, weight: s.fontWeight, bg: s.backgroundColor };
  });
  expect(await style(names[1])).toMatchObject({ radius: "7px", font: "12.8px", weight: "400" });
  expect((await style(names[0])).bg).toBe("rgba(0, 0, 0, 0)");
  expect((await style(names[1])).bg).not.toBe("rgba(0, 0, 0, 0)");
  const plus = (await tabs.getByRole("button", { name: "New tab" }).boundingBox())!;
  expect([plus.width, plus.height]).toEqual([26, 26]);
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

  // A pointer drag of the second tab over the first moves it there; the tab under the drag shows lifted.
  const from = (await tabs.getByRole("tab", { name: b }).boundingBox())!;
  const to = (await tabs.getByRole("tab", { name: a }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 10 });
  // The dragged tab's place shows as a 2 px line where it will drop.
  const line = tabs.locator("[data-grabbed]");
  await expect(line).toHaveCount(1);
  expect((await line.boundingBox())!.width).toBeLessThanOrEqual(3);
  // The copy under the pointer moves down, so the screenshot shows the line.
  await page.mouse.move(to.x + 10, to.y + to.height / 2 + 40, { steps: 3 });
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `tab-drag-${scheme}.png`), clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1200, height: 120 } });
  }
  await page.mouse.up();
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);

  // Alt with Right moves the focused tab one place; Alt with Home moves it first.
  await tabs.getByRole("tab", { name: b }).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(tabs.getByRole("tab")).toHaveText([a, b]);
  await expect(tabs.getByRole("tab", { name: b })).toBeFocused();
  await page.keyboard.press("Alt+Home");
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);
  // A plain arrow does not move it.
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab")).toHaveText([b, a]);
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
