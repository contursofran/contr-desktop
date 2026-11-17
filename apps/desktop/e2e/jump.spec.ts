import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatList, chatRow, chatSettled } from "./chat";
import { launchApp } from "./launch";

// The ↓ button that goes back to the end of the chat (issue #114). Keys go through Playwright's page
// keyboard (into the page only): no OS-level keys or mouse.
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

function rows(from: number, to: number): string {
  const out: string[] = [];
  for (let i = from; i < to; i++) {
    const ts = 1793670000000 + i * 1000;
    if (i % 2 === 0) out.push(JSON.stringify({ id: `r${i}`, k: "user", text: `Question ${i}`, ts }));
    else out.push(JSON.stringify({ id: `r${i}`, k: "assistant", text: `Answer ${i}. ${"Some words in a longer line. ".repeat(i % 6)}`, ts }));
  }
  return `${out.join("\n")}\n`;
}

async function open(size?: [number, number]) {
  const fixture = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "long.jsonl");
  writeFileSync(fixture, rows(0, 120));
  const app = await launchApp({ CONTR_HELPER: path.join(e2e, "fake-helper.mjs"), FAKE_HELPER_FIXTURE: fixture, CONTR_HC: path.join(e2e, "fake-hc.mjs") });
  const page = await app.firstWindow();
  if (size) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), size);
    await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual(size);
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(chatList(page).locator('[data-row-id="r119"]')).toBeInViewport();
  await chatSettled(page);
  return { app, page, append: (from: number, to: number) => appendFileSync(fixture, rows(from, to)) };
}

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

const jump = (page: Page) => page.getByRole("button", { name: "Jump to the end" });
const fromEnd = (page: Page) => chatList(page).evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);

test("the ↓ button shows away from the end, marks new rows, and goes back to the end", async () => {
  test.setTimeout(60_000);
  const { app, page, append } = await open();
  // At the end: no button.
  await expect(jump(page)).toHaveCount(0);

  // Scrolled up: the button shows, with no mark.
  const middle = await chatRow(page, "r40");
  await expect(jump(page)).toBeVisible();
  await expect(jump(page)).not.toHaveAttribute("data-fresh");
  await shoot(page, "jump-up");

  // New rows while scrolled up: the list keeps its place and the button takes the accent color.
  const before = await middle.boundingBox();
  append(120, 130);
  await expect(jump(page)).toHaveAttribute("data-fresh", "true");
  await expect(jump(page)).toHaveAccessibleDescription("New messages");
  await chatSettled(page);
  expect((await middle.boundingBox())?.y).toBe(before?.y);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim());
  const color = await jump(page).evaluate((el) => getComputedStyle(el).color);
  const probe = await page.evaluate((c) => { const d = document.createElement("div"); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, accent);
  expect(color).toBe(probe);
  await shoot(page, "jump-new");

  // A press goes to the end; the button goes away and does not cover the last row.
  await jump(page).click();
  await expect(chatList(page).locator('[data-row-id="r129"]')).toBeInViewport();
  await chatSettled(page);
  expect(await fromEnd(page)).toBeLessThan(2);
  await expect(jump(page)).toHaveCount(0);

  // Scrolled up again after the press: the mark is gone.
  await chatRow(page, "r40");
  await expect(jump(page)).toBeVisible();
  await expect(jump(page)).not.toHaveAttribute("data-fresh");
  await app.close();
});

test("Tab reaches the ↓ button right after the reply box", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open();
  await chatRow(page, "r40");
  await expect(jump(page)).toBeVisible();
  await page.getByRole("form", { name: "Reply" }).getByRole("textbox").focus();
  // Tab through the reply box's controls; the first stop outside it is the ↓ button.
  for (let i = 0; i < 12 && (await page.evaluate(() => !!document.activeElement?.closest("fieldset"))); i++) await page.keyboard.press("Tab");
  await expect(jump(page)).toBeFocused();
  // Enter presses it.
  await page.keyboard.press("Enter");
  await expect(chatList(page).locator('[data-row-id="r119"]')).toBeInViewport();
  await expect(jump(page)).toHaveCount(0);
  await app.close();
});

test("in a 900x600 window the ↓ button is 34 px, centered on the reading column, above the reply box", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open([900, 600]);
  // A classic scrollbar that takes width, as on the CI runner (macOS here shows an overlay one by default).
  await page.addStyleTag({ content: '[aria-label="Chat"]::-webkit-scrollbar { width: 15px; } [aria-label="Chat"]::-webkit-scrollbar-thumb { background: gray; }' });
  expect(await chatList(page).evaluate((el) => (el as HTMLElement).offsetWidth - el.clientWidth)).toBe(15);
  const row = await chatRow(page, "r40");
  const button = (await jump(page).boundingBox())!;
  const column = (await row.boundingBox())!;
  const reply = (await page.getByRole("form", { name: "Reply" }).getByRole("textbox").boundingBox())!;
  expect(button.width).toBe(34);
  expect(button.height).toBe(34);
  expect(Math.abs(button.x + button.width / 2 - (column.x + column.width / 2))).toBeLessThan(1);
  expect(button.y + button.height).toBeLessThan(reply.y);
  await shoot(page, "jump-900x600");
  await app.close();
});
