import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { addStyle, chatList, chatRow, chatSettled, findRow, renderFeed, rowInViewport, shoot } from "../../test/274-chat";
import type { FeedRow } from "../shared/api";

// The ↓ button that goes back to the end of the chat (issue #114).
function rows(from: number, to: number): FeedRow[] {
  const out: FeedRow[] = [];
  for (let i = from; i < to; i++) {
    const ts = 1793670000000 + i * 1000;
    if (i % 2 === 0) out.push({ id: `r${i}`, k: "user", text: `Question ${i}`, ts });
    else out.push({ id: `r${i}`, k: "assistant", text: `Answer ${i}. ${"Some words in a longer line. ".repeat(i % 6)}`, ts });
  }
  return out;
}

async function open(size?: [number, number]) {
  const append = await renderFeed(rows, 120);
  if (size) {
    await page.viewport(...size);
    await expect.poll(() => [window.innerWidth, window.innerHeight]).toEqual(size);
  }
  await rowInViewport("r119");
  await chatSettled();
  return append;
}

const jump = () => page.getByRole("button", { name: "Jump to the end" });
const replyBox = () => page.getByRole("form", { name: "Reply" }).getByRole("textbox");

test("the ↓ button marks new rows and reaches the exact end of a 636 px list", async ({ onTestFinished }) => {
  const append = await open([1200, 818]);
  const list = chatList().element();
  expect(list.clientHeight).toBe(636);
  await expect.poll(() => jump().length).toBe(0);

  // Scrolled up: the button shows, with no mark.
  const middle = await chatRow("r40");
  await expect.element(jump()).toBeVisible();
  await expect.element(jump()).not.toHaveAttribute("data-fresh");
  await shoot("jump-up");

  // New rows while scrolled up: the list keeps its place and the button takes the accent color.
  const before = middle.getBoundingClientRect().y;
  append(120, 130);
  await expect.element(jump()).toHaveAttribute("data-fresh", "true");
  await expect.element(jump()).toHaveAccessibleDescription("New messages");
  await chatSettled();
  expect(findRow("r40")?.getBoundingClientRect().y).toBe(before);
  const probe = document.createElement("div");
  probe.style.color = "var(--color-accent)";
  document.body.append(probe);
  const accent = getComputedStyle(probe).color;
  probe.remove();
  expect(getComputedStyle(jump().element()).color).toBe(accent);
  await shoot("jump-new");

  // A press goes to the end, and the button goes away.
  // Grow the range on the frame after the scroll reaches the measured end.
  // Chromium can deliver scrollend separately from that last scroll.
  const growth = new Promise<number>((resolve) => {
    function growAtEnd() {
      if (list.scrollTop !== list.scrollHeight - list.clientHeight) return;
      list.removeEventListener("scroll", growAtEnd);
      requestAnimationFrame(() => {
        const height = list.scrollHeight;
        const spacer = document.createElement("div");
        spacer.style.height = "2px";
        list.append(spacer);
        resolve(list.scrollHeight - height);
      });
    }
    list.addEventListener("scroll", growAtEnd);
    onTestFinished(() => list.removeEventListener("scroll", growAtEnd));
  });
  await jump().click();
  expect(await growth).toBe(2);
  await rowInViewport("r129");
  await expect.poll(() => list.scrollHeight - list.clientHeight - list.scrollTop).toBe(0);
  await expect.poll(() => jump().length).toBe(0);
  await shoot("jump-end-636");

  await chatRow("r40");
  await expect.element(jump()).toBeVisible();
  await expect.element(jump()).not.toHaveAttribute("data-fresh");
}, 60_000);

test("Tab reaches the ↓ button right after the reply box", async () => {
  await open();
  await chatRow("r40");
  await expect.element(jump()).toBeVisible();
  (await replyBox().findElement()).focus();
  // Tab through the reply box's controls; the first stop outside it is the ↓ button.
  for (let i = 0; i < 12 && document.activeElement?.closest("fieldset"); i++) {
    await userEvent.keyboard("{Tab}");
  }
  await expect.element(jump()).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await rowInViewport("r119");
  await expect.poll(() => jump().length).toBe(0);
}, 60_000);

test("in a 900x600 window the ↓ button is 34 px, centered on the reading column, above the reply box", async () => {
  await open([900, 600]);
  // Give overlay scrollbars the same width as a classic scrollbar.
  addStyle('[aria-label="Chat"]::-webkit-scrollbar { width: 15px; } [aria-label="Chat"]::-webkit-scrollbar-thumb { background: gray; }');
  const list = chatList().element() as HTMLElement;
  expect(list.offsetWidth - list.clientWidth).toBe(30);
  const row = await chatRow("r40");
  const button = (await jump().findElement()).getBoundingClientRect();
  const column = row.getBoundingClientRect();
  const reply = replyBox().element().getBoundingClientRect();
  expect(button.width).toBe(34);
  expect(button.height).toBe(34);
  expect(Math.abs(button.x + button.width / 2 - (column.x + column.width / 2))).toBeLessThan(1);
  expect(button.y + button.height).toBeLessThan(reply.y);
  await shoot("jump-900x600");
}, 60_000);
