import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

async function start() {
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  });
  return { app, page: await app.firstWindow() };
}

async function hover(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("the machine switch opens with keys and the mouse, keeps This computer, and gives focus back", async () => {
  test.setTimeout(60_000);
  const { app, page } = await start();
  const trigger = page.locator("aside > header").getByRole("button", { name: "Machine" });
  const menu = page.getByRole("menu", { name: "Machine" });
  await expect(trigger).toHaveText("This computer");

  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitemradio")).toHaveText(["This computer", "aerum-pc", "vpsunreachable"]);
  await expect(menu.getByRole("menuitemradio", { name: "This computer" })).toHaveAttribute("aria-checked", "true");
  await expect(menu.getByRole("menuitem", { name: "Add machine…" })).toBeVisible();
  // The other machines are inert until the pick filters (small-texts.spec.ts): Enter picks This computer.
  await shoot(page, "sidebar-machines");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveText("This computer");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await hover(page, trigger);
  await page.mouse.down();
  await page.mouse.up();
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name: "This computer" }).hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveText("This computer");

  await hover(page, trigger);
  await page.mouse.down();
  await page.mouse.up();
  await expect(menu).toBeVisible();
  await hover(page, page.getByRole("textbox", { name: /Reply to/ }));
  await page.mouse.down();
  await page.mouse.up();
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveText("This computer");
  await app.close();
});

test("the sidebar and top bar tooltips show on hover and focus, and Escape or leaving hides them", async () => {
  test.setTimeout(60_000);
  const { app, page } = await start();
  const tip = page.getByRole("tooltip");
  const nav = page.getByRole("navigation", { name: "Projects" });

  await hover(page, nav.getByRole("button", { name: /Flow and sequence diagrams/ }));
  await expect(tip).toHaveText("b-30 · #30 · Flow and sequence diagrams");
  await shoot(page, "sidebar-row-tooltip");
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  await hover(page, nav.getByRole("button", { name: /Chat panel usability audit/ }));
  await expect(tip).toHaveText("Chat panel usability audit");
  await hover(page, page.getByRole("textbox", { name: /Reply to/ }));
  await expect(tip).toBeHidden();

  const tabs = page.getByRole("tablist", { name: "Tabs" });
  await hover(page, tabs.getByRole("tab", { name: "Chat panel usability audit" }));
  await expect(tip).toHaveText("Chat panel usability audit");
  await hover(page, page.getByRole("button", { name: "New tab" }));
  await expect(tip).toHaveText("New tab");
  await shoot(page, "topbar-tooltip");

  const search = page.locator("aside > header").getByRole("button", { name: "Search" });
  await search.focus();
  await expect(tip).toHaveText("Search (not yet)");
  await page.keyboard.press("Tab");
  await expect(tip).toHaveText("Hide sidebar");
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();
  await expect(page.locator("aside > header").getByRole("button", { name: "Hide sidebar" })).toBeFocused();

  await hover(page, page.locator("aside > footer").getByRole("button", { name: "Add machine" }));
  await expect(tip).toHaveText("Add machine (not yet)");
  await shoot(page, "sidebar-foot-tooltip");
  await app.close();
});
