import { expect, test, type ElectronApplication, type Locator, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

const base = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

async function hover(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function press(page: Page, target: Locator) {
  await hover(page, target);
  await page.mouse.down();
  await page.mouse.up();
}

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

const size = (app: ElectronApplication, w: number, h: number) =>
  app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w, h), [w, h]);

test("at 600 px the model button stays on one line and the shown tab fits the row; model, context and menu say plain words", async () => {
  test.setTimeout(60_000);
  const app = await launchApp(base);
  const page = await app.firstWindow();
  await size(app, 600, 450);
  const tip = page.getByRole("tooltip");

  // G7: "Opus 5.5" on one line: as high as the effort text.
  const model = page.getByRole("button", { name: "Model" });
  await expect(model).toContainText("Opus 5.5");
  const height = (text: string) => model.getByText(text, { exact: true }).evaluate((e) => e.getBoundingClientRect().height);
  await expect.poll(async () => (await height("Opus 5.5")) - (await height("medium"))).toBe(0);

  // G12: the shown tab is in the row from its start, and its title truncates.
  const row = page.locator("[data-tab-row]");
  const tab = row.getByRole("tab", { selected: true });
  await expect(tab).toHaveText("Chat panel usability audit");
  await expect.poll(async () => {
    const [r, t] = [(await row.boundingBox())!, (await tab.locator("..").boundingBox())!];
    return t.x >= r.x - 0.5 && t.x + t.width <= r.x + r.width + 0.5;
  }).toBe(true);
  expect(await tab.locator("[data-title]").evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  await shoot(page, "small-texts-600");

  // G16: the tooltips in plain words.
  await hover(page, model);
  await expect(tip).toHaveText("Opus 5.5 · medium effort · Claude Code");
  await shoot(page, "small-texts-model-tip");
  await hover(page, page.getByLabel("Context 37%"));
  await expect(tip).toHaveText("37% of the model's context window");
  await shoot(page, "small-texts-context-tip");

  // G16: the menu has a "Model" and an "Effort" group.
  await press(page, model);
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("group", { name: "Model" }).getByRole("menuitemradio")).toHaveText(["Opus 5.5", "Sonnet 5"]);
  await expect(menu.getByRole("group", { name: "Effort" }).getByRole("menuitemradio")).toHaveText(["low", "medium", "high"]);
  await shoot(page, "small-texts-model-menu");
  await app.close();
});

test("other machines are inert with (not yet), and the label stays This computer; a project row has its name as tooltip", async () => {
  test.setTimeout(60_000);
  const app = await launchApp(base);
  const page = await app.firstWindow();
  const tip = page.getByRole("tooltip");

  // G15
  const name = page.getByRole("navigation", { name: "Projects" }).locator("[data-name]").first();
  await expect(name).toHaveText("contr-desktop");
  await hover(page, name);
  await expect(tip).toHaveText("contr-desktop");
  await shoot(page, "small-texts-project-tip");

  // G9
  const trigger = page.locator("aside > header").getByRole("button", { name: "Machine" });
  await press(page, trigger);
  const menu = page.getByRole("menu", { name: "Machine" });
  await expect(menu.getByRole("menuitemradio", { name: "This computer" })).toHaveAttribute("aria-checked", "true");
  const aerum = menu.getByRole("menuitemradio", { name: "aerum-pc" });
  await expect(aerum).toHaveAttribute("aria-disabled", "true");
  await expect(menu.getByRole("menuitemradio", { name: /vps/ })).toHaveAttribute("aria-disabled", "true");
  await hover(page, aerum);
  await expect(tip).toHaveText("aerum-pc (not yet)");
  await shoot(page, "small-texts-machines");
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveText("This computer");
  await app.close();
});

test("a terminal with no known title gets the placeholder Reply, with no name", async () => {
  test.setTimeout(60_000);
  // G11: t1 is not in the sidebar; hc gives it no title and no agent.
  const app = await launchApp({ ...base, FAKE_HC_AGENTS: "0", CONTR_TERMINAL: "t1" });
  const page = await app.firstWindow();
  const box = page.getByRole("form", { name: "Reply" }).getByRole("textbox");
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Terminal");
  await expect(box).toHaveAttribute("placeholder", "Reply");
  await expect(box).toHaveAccessibleName("Reply");
  await shoot(page, "small-texts-reply");
  await app.close();
});

test("the helper path in Settings and in the helper error has a tooltip with the whole path and Copy", async () => {
  test.setTimeout(60_000);
  const flag = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-flag-")), "down");
  writeFileSync(flag, "");
  const app = await launchApp({ ...base, FAKE_HELPER_ERROR_WHILE: flag });
  const page = await app.firstWindow();
  const tip = page.getByRole("tooltip");

  // G13: the error block.
  const alert = page.getByRole("alert", { name: "Helper error" });
  await hover(page, alert.getByLabel("Helper path"));
  await expect(tip).toHaveText(base.CONTR_HELPER);
  await shoot(page, "small-texts-helper-error");
  await app.evaluate(({ clipboard }) => clipboard.clear());
  await press(page, alert.getByRole("button", { name: "Copy path" }));
  await expect(alert.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(base.CONTR_HELPER);

  // G13: Settings, in a narrow window.
  await size(app, 900, 600);
  await press(page, page.locator("aside > footer").getByRole("button", { name: "Settings" }));
  const view = page.getByRole("region", { name: "Settings" });
  await hover(page, view.getByLabel("Helper path"));
  await expect(tip).toHaveText(base.CONTR_HELPER);
  await expect(view.getByRole("button", { name: "Copy path" })).toBeVisible();
  await shoot(page, "small-texts-settings-path");
  await app.close();
});
