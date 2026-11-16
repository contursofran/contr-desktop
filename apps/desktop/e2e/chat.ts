import { expect, type Locator, type Page } from "@playwright/test";

/** The chat list. It is virtual: only the rows near the viewport are in the DOM. */
export const chatList = (page: Page): Locator => page.locator("[aria-label=Chat]");

/** One chat row, found by its helper row id. Scrolls the list from the top until the row is in the DOM. */
export async function chatRow(page: Page, id: string): Promise<Locator> {
  const row = chatList(page).locator(`[data-row-id="${id}"]`);
  const list = chatList(page);
  await list.locator("[role=listitem]").first().waitFor();
  // The list opens at its end and scrolls there after it measures the rows. Wait until it stands
  // still: else that scroll pulls the list back while we search.
  let last = "";
  await expect
    .poll(async () => {
      const now = await list.evaluate((el) => `${el.scrollTop} ${el.scrollHeight} ${el.clientHeight}`);
      const still = now === last;
      last = now;
      return still;
    }, { intervals: [150] })
    .toBe(true);
  for (let top = 0; top < 1_000_000; ) {
    await list.evaluate((el, y) => el.scrollTo({ top: y }), top);
    await page.waitForTimeout(50);
    if (await row.count()) {
      // The list can mount the row again while it measures it, so Playwright's wait for a still
      // element can time out. Scroll it from the DOM and wait until it is in view.
      await expect(async () => {
        await row.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
        await expect(row).toBeInViewport({ timeout: 500 });
      }).toPass({ timeout: 10_000 });
      return row;
    }
    const { height, max } = await list.evaluate((el) => ({ height: el.clientHeight, max: el.scrollHeight - el.clientHeight }));
    if (top >= max) break;
    top = Math.min(top + height / 2, max);
  }
  throw new Error(`chat row ${id} not found`);
}
