import { expect, test } from "vitest";
import { page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { addStyle, chatList, chatRow, findRow, rowInViewport, shoot } from "../../test/274-chat";
import { renderApp } from "../../test/renderApp";

const status = () => document.querySelector("[aria-label=Status]")!;
const reply = () => document.querySelector("[aria-label=Reply]")!;

/** The left and right edges of the reading column's parts. */
function edges() {
  const box = (element: Element) => {
    const b = element.getBoundingClientRect();
    return { left: Math.round(b.x), right: Math.round(b.right), width: Math.round(b.width) };
  };
  return { row: box(findRow("a6")!), status: box(status()), reply: box(reply()) };
}

// docs/design/redesign/chat-screen.html, .col and .bottom
test("the reading column is at most 760 px and its parts line up", async () => {
  await renderApp(transcript);
  await page.viewport(1440, 900);
  // Give overlay scrollbars the same width as a classic scrollbar.
  addStyle("::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: gray; }");
  await rowInViewport("a6");
  await chatRow("a6");

  const list = chatList().element();
  const adjacent = () => list.querySelectorAll('[data-row-id="a5"], [data-row-id="a6"]');
  await expect.poll(() => adjacent().length).toBe(2);
  const [before, after] = Array.from(adjacent());
  expect(getComputedStyle(before.nextElementSibling!).height).toBe("12px");
  // Legend List can round a row height to the nearest pixel.
  expect(after.getBoundingClientRect().top - before.getBoundingClientRect().bottom).toBeCloseTo(12, 0);

  const wide = edges();
  expect(wide.row.width).toBe(760);
  expect(wide.status).toEqual(wide.row);
  expect(wide.reply).toEqual(wide.row);
  expect(getComputedStyle(list).paddingInline).toBe("56px");
  expect(getComputedStyle(document.querySelector("div:has(> [aria-label=Status])")!).paddingInline).toBe("56px");
  const seg = page.getByRole("radiogroup", { name: "Chat or Terminal" }).element().getBoundingClientRect();
  expect(wide.row.right).toBeLessThan(seg.x);
  await shoot("column-1440");

  // At 640 px, the column fills the chat area and the parts still line up.
  await page.viewport(640, 600);
  await expect.poll(() => edges().row.width).toBeLessThan(760);
  const narrow = edges();
  // Under 768 px the side padding is 16 px, so the status line keeps its words (reply.spec.ts).
  expect(getComputedStyle(list).paddingInline).toBe("16px");
  expect(narrow.status).toEqual(narrow.row);
  expect(narrow.reply).toEqual(narrow.row);
  await shoot("column-640");
}, 60_000);
