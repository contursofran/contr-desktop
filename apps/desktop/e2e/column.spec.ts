import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { chatList, chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");

/** The left and right edges of the reading column's parts: a chat row, the status line and the reply box. */
async function edges(page: Page) {
  const box = async (selector: string) => {
    const b = (await page.locator(selector).first().boundingBox())!;
    return { left: Math.round(b.x), right: Math.round(b.x + b.width), width: Math.round(b.width) };
  };
  return {
    row: await box('[aria-label=Chat] [data-row-id="a6"]'),
    status: await box("[aria-label=Status]"),
    reply: await box("[aria-label=Reply]"),
  };
}

// The recipe's reading column (docs/design/recipe-herdr.md): at most 1000 px wide, centered.
// The rows, the status line and the reply box have the same edges at each window width, with a classic scrollbar too.
test("the reading column is at most 1000 px and its parts line up", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1600, height: 900 });
  // A classic scrollbar that takes width, as on the CI runner (macOS here shows an overlay one by default).
  await page.addStyleTag({ content: "::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: gray; }" });
  await expect(chatList(page).locator('[data-row-id="a6"]')).toBeInViewport();
  await chatRow(page, "a6");

  const wide = await edges(page);
  expect(wide.row.width).toBe(1000);
  expect(wide.status).toEqual(wide.row);
  expect(wide.reply).toEqual(wide.row);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `column-1600-${scheme}.png`) });
  }

  // A narrow window: the column fills the chat area, less its gutters, and the parts still line up.
  await page.setViewportSize({ width: 900, height: 600 });
  await expect.poll(async () => (await edges(page)).row.width).toBeLessThan(1000);
  const narrow = await edges(page);
  expect(narrow.status).toEqual(narrow.row);
  expect(narrow.reply).toEqual(narrow.row);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `column-900-${scheme}.png`) });
  }
  await app.close();
});
