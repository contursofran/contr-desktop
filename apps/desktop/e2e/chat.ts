import { expect, type Locator, type Page } from "@playwright/test";

/** The chat list. It is virtual: only the rows near the viewport are in the DOM. */
export const chatList = (page: Page): Locator => page.locator("[aria-label=Chat]");

/**
 * Runs in the page, on the list element. Playwright sends only this function's source, so all parts are inside it.
 *
 * `settle` waits until the list stands still: the same scroll position, height and rendered rows for
 * 3 frames in a row. The list renders the new range one or more frames after a scroll, and it can
 * move by itself: to its end at start, and to keep the visible rows in place when rows above change height.
 *
 * With an id, it searches from the top, half a viewport per step, and settles after each step. When the
 * row is in the DOM, it scrolls the row into view and settles again. It gives "" when the row is in view,
 * else what the list showed. With no id, it only settles and gives "".
 */
async function inList(el: Element, id: string | null): Promise<string> {
  // A frame, or 100 ms when the page gives no frame.
  const frame = () => new Promise<void>((done) => { requestAnimationFrame(() => done()); setTimeout(done, 100); });
  const ids = () => Array.from(el.querySelectorAll("[data-row-id]"), (r) => r.getAttribute("data-row-id")).join(",");
  const settle = async () => {
    let last = "";
    // At most 120 frames (about 2 s): a list that never stands still fails the check after it, not here.
    for (let same = 0, i = 0; same < 3 && i < 120; i++) {
      await frame();
      const now = `${el.scrollTop} ${el.scrollHeight} ${ids()}`;
      same = now === last ? same + 1 : 0;
      last = now;
    }
  };
  await settle();
  if (id === null) return "";
  const find = () => el.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
  const inView = (row: Element) => {
    const a = row.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return a.bottom > b.top && a.top < b.bottom;
  };
  for (let top = 0; ; ) {
    el.scrollTo({ top });
    await settle();
    const row = find();
    if (row) {
      row.scrollIntoView({ block: "nearest" });
      await settle();
      const now = find();
      if (now && inView(now)) return "";
    }
    const max = el.scrollHeight - el.clientHeight;
    if (top >= max) return `scrollTop ${el.scrollTop}, max ${max}, height ${el.clientHeight}, rows ${ids()}`;
    top = Math.min(top + el.clientHeight / 2, max);
  }
}

/** Waits until the chat list stands still. Use it in place of a fixed wait after a change to the list. */
export async function chatSettled(page: Page): Promise<void> {
  await chatList(page).evaluate(inList, null);
}

/**
 * One chat row, found by its helper row id and scrolled into view. The search settles the list after
 * each scroll, so the list's own scroll cannot move it away unseen. When the row is not found or is not
 * in view after the search, the whole search runs again.
 */
export async function chatRow(page: Page, id: string): Promise<Locator> {
  const list = chatList(page);
  const row = list.locator(`[data-row-id="${id}"]`);
  await list.locator("[role=listitem]").first().waitFor();
  await expect(async () => {
    expect(await list.evaluate(inList, id), `chat row ${id} not found`).toBe("");
    await expect(row).toBeInViewport({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  return row;
}
