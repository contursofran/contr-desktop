import { expect } from "vitest";
import { page } from "vitest/browser";

export const browserShots = "../../../../tmp/shots/browser";

/** Bring a fixture row into view after the virtual list's initial jump to the end. */
export async function chatRow(id: string, block: ScrollLogicalPosition = "nearest") {
  const list = await page.getByRole("list", { name: "Chat" }).findElement();
  const selector = `[data-row-id="${CSS.escape(id)}"]`;
  await expect.poll(() => {
    const item = list.querySelector(selector);
    if (!item) {
      list.scrollTop = 0;
      return false;
    }
    item.scrollIntoView({ block });
    const box = item.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    return box.bottom > view.top && box.top < view.bottom;
  }).toBe(true);
  return list.querySelector<HTMLElement>(selector)!;
}

/** Normalize whitespace as Playwright's string text assertions do. */
export function normalizedText(element: Element) {
  return (element.textContent ?? "").replace(/[\u200b\u00ad]/g, "").trim().replace(/\s+/g, " ");
}
