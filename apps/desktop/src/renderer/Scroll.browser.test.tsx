import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { chatList, chatRow, chatSettled, findRow, renderFeed, rowInViewport, shoot } from "../../test/274-chat";
import { renderApp } from "../../test/renderApp";
import type { FeedRow } from "../shared/api";

/** Rows of different heights: short user rows, Markdown with a table, and tool chips. */
function rows(from: number, to: number): FeedRow[] {
  const out: FeedRow[] = [];
  for (let i = from; i < to; i++) {
    const ts = 1793670000000 + i * 1000;
    if (i % 3 === 0) out.push({ id: `r${i}`, k: "user", text: `Question ${i}`, ts });
    else if (i % 3 === 1)
      out.push({ id: `r${i}`, k: "assistant", text: `Answer ${i}\n\n| a | b |\n|---|---|\n| ${i} | ${"x ".repeat(i % 40)} |\n\nLine ${"y ".repeat(i % 90)}`, ts });
    else
      out.push({ id: `r${i}`, k: "tools", ts, chips: [{ symbol: "terminal", text: `Ran command ${i}`, calls: [{ name: "Bash", summary: `step ${i}`, done: true, error: false, output: "ok\n".repeat(8) }] }] });
  }
  return out;
}

test("the chat follows new rows at the end and stays put when scrolled up", async () => {
  const append = await renderFeed(rows, 300);
  const list = await chatList().findElement();

  // It opens at the end, and keeps only the rows near the viewport in the DOM.
  await rowInViewport("r299");
  expect(list.querySelectorAll("[role=listitem]").length).toBeLessThan(100);
  await expect.poll(() => findRow("r0", list)).toBeNull();

  // At the end, new rows come into view.
  append(300, 330);
  await rowInViewport("r329");
  await expect.poll(() => list.scrollHeight - list.clientHeight - list.scrollTop).toBeLessThan(2);
  await shoot("virtual-list-end", false);

  // Scrolled up, new rows do not move the view.
  const middle = await chatRow("r150");
  const before = middle.getBoundingClientRect().y;
  const top = list.scrollTop;
  const height = list.scrollHeight;
  append(330, 360);
  await expect.poll(() => list.scrollHeight).toBeGreaterThan(height);
  await chatSettled(list);
  expect(list.scrollTop).toBe(top);
  expect(findRow("r150", list)?.getBoundingClientRect().y).toBe(before);

  // A row above the viewport that opens does not move the rows on screen.
  const below = await chatRow("r160");
  below.scrollIntoView({ block: "start" });
  await chatSettled(list);
  const y = findRow("r160", list)!.getBoundingClientRect().y;
  const chip = () => page.getByRole("button", { name: /Ran command 158/ }).elements()
    .find((button) => findRow("r158", list)?.contains(button)) as HTMLElement | undefined;
  // A user click would scroll the chip into view before opening it.
  chip()!.click();
  await expect.poll(() => chip()?.getAttribute("aria-expanded")).toBe("true");
  await chatSettled(list);
  expect(findRow("r160", list)?.getBoundingClientRect().y).toBeCloseTo(y, 0);
  await shoot("virtual-list-middle", false);
}, 60_000);

test("chatRow finds a row while the list still pulls itself to its end", async () => {
  await renderApp(transcript);
  const list = await chatList().findElement();
  await expect.element(chatList().getByRole("listitem").first()).toBeVisible();
  // As Legend List does at start, a scroll away from the end goes back to the end on the next frame.
  const end = performance.now() + 3000;
  list.addEventListener("scroll", () => {
    if (performance.now() < end) requestAnimationFrame(() => list.scrollTo({ top: list.scrollHeight }));
  });
  // sep-1 is the first row. It is in the DOM only near the top.
  await expect.element(await chatRow("sep-1")).toHaveTextContent("14:05");
}, 60_000);

test("chatRow brings a row past the top clip after the first scroll", async ({ onTestFinished }) => {
  await renderApp(transcript);
  const list = await chatList().findElement();
  await expect.element(chatList().getByRole("listitem").first()).toBeVisible();
  await chatSettled(list);
  list.scrollTop = 0;
  await rowInViewport("sep-1");
  const separator = findRow("sep-1", list)!.getBoundingClientRect();
  const clipped = Math.round(separator.top - list.getBoundingClientRect().top - 8);

  // Leave the first seek at a real scroll position inside the list's clip.
  let displaced = false;
  const scroll = vi.spyOn(list, "scrollTo").mockImplementation((position: number | ScrollToOptions) => {
    const top = typeof position === "number" ? position : position.top;
    if (top === 0 && !displaced) {
      displaced = true;
      list.scrollTop = clipped;
    } else if (top !== undefined) {
      list.scrollTop = top;
    }
  });
  onTestFinished(() => scroll.mockRestore());
  await expect.element(await chatRow("sep-1")).toHaveTextContent("14:05");
  expect(displaced).toBe(true);
}, 20_000);
