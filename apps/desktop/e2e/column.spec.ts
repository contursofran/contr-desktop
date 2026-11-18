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

// The redesign's reading column (docs/design/redesign/chat-screen.html, `.col` and `.bottom`): at most 760 px wide,
// centered, with 56 px side padding. The rows, the status line and the reply box have the same edges at each window
// width, with a classic scrollbar too, and the text stays clear of the Chat or Terminal switch.
test("the reading column is at most 760 px and its parts line up", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  // A classic scrollbar that takes width, as on the CI runner (macOS here shows an overlay one by default).
  await page.addStyleTag({ content: "::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: gray; }" });
  await expect(chatList(page).locator('[data-row-id="a6"]')).toBeInViewport();
  await chatRow(page, "a6");

  const wide = await edges(page);
  expect(wide.row.width).toBe(760);
  expect(wide.status).toEqual(wide.row);
  expect(wide.reply).toEqual(wide.row);
  // The mock's side padding, on the list and on the block of the cards, the status line and the reply box.
  const padding = (selector: string) => page.locator(selector).evaluate((e) => getComputedStyle(e).paddingInline);
  expect(await padding("[aria-label=Chat]")).toBe("56px");
  expect(await padding("div:has(> [aria-label=Status])")).toBe("56px");
  // The column ends left of the Chat or Terminal switch.
  const seg = (await page.getByRole("group", { name: "Chat or Terminal" }).boundingBox())!;
  expect(wide.row.right).toBeLessThan(seg.x);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `column-1440-${scheme}.png`) });
  }

  // A narrow window (640 px): the column fills the chat area, less its gutters, and the parts still line up.
  await page.setViewportSize({ width: 640, height: 600 });
  await expect.poll(async () => (await edges(page)).row.width).toBeLessThan(760);
  const narrow = await edges(page);
  // Under 768 px the side padding is 16 px, so the status line keeps its words (reply.spec.ts).
  expect(await padding("[aria-label=Chat]")).toBe("16px");
  expect(narrow.status).toEqual(narrow.row);
  expect(narrow.reply).toEqual(narrow.row);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `column-640-${scheme}.png`) });
  }
  await app.close();
});
