import type { Locator, Page } from "@playwright/test";

/** The chat list. It is virtual: only the rows near the viewport are in the DOM. */
export const chatList = (page: Page): Locator => page.locator("[aria-label=Chat]");

/** One chat row, found by its helper row id. Scrolls the list from the top until the row is in the DOM. */
export async function chatRow(page: Page, id: string): Promise<Locator> {
  const row = chatList(page).locator(`[data-row-id="${id}"]`);
  const list = chatList(page);
  await list.locator("[role=listitem]").first().waitFor();
  for (let top = 0; top < 1_000_000; ) {
    await list.evaluate((el, y) => el.scrollTo({ top: y }), top);
    await page.waitForTimeout(50);
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded();
      return row;
    }
    const { height, max } = await list.evaluate((el) => ({ height: el.clientHeight, max: el.scrollHeight - el.clientHeight }));
    if (top >= max) break;
    top = Math.min(top + height / 2, max);
  }
  throw new Error(`chat row ${id} not found`);
}
