import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatList, chatRow, chatSettled } from "./chat";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

/** Rows of different heights: short user rows, Markdown with a table, and tool chips. */
function rows(from: number, to: number): string {
  const out: string[] = [];
  for (let i = from; i < to; i++) {
    const ts = 1793670000000 + i * 1000;
    if (i % 3 === 0) out.push(JSON.stringify({ id: `r${i}`, k: "user", text: `Question ${i}`, ts }));
    else if (i % 3 === 1)
      out.push(JSON.stringify({ id: `r${i}`, k: "assistant", text: `Answer ${i}\n\n| a | b |\n|---|---|\n| ${i} | ${"x ".repeat(i % 40)} |\n\nLine ${"y ".repeat(i % 90)}`, ts }));
    else
      out.push(JSON.stringify({ id: `r${i}`, k: "tools", ts, chips: [{ symbol: "terminal", text: `Ran command ${i}`, calls: [{ name: "Bash", summary: `step ${i}`, done: true, error: false, output: "ok\n".repeat(8) }] }] }));
  }
  return `${out.join("\n")}\n`;
}

const scroll = (page: Page) => chatList(page).evaluate((el) => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));

test("the chat follows new rows at the end and stays put when scrolled up", async () => {
  test.setTimeout(60_000);
  const fixture = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "long.jsonl");
  writeFileSync(fixture, rows(0, 300));
  const app = await launchApp({ CONTR_HELPER: path.join(e2e, "fake-helper.mjs"), FAKE_HELPER_FIXTURE: fixture, CONTR_HC: path.join(e2e, "fake-hc.mjs") });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const list = chatList(page);

  // It opens at the end, and keeps only the rows near the viewport in the DOM.
  await expect(list.locator('[data-row-id="r299"]')).toBeInViewport();
  expect(await list.locator("[role=listitem]").count()).toBeLessThan(100);
  await expect(list.locator('[data-row-id="r0"]')).toHaveCount(0);

  // At the end, new rows come into view.
  appendFileSync(fixture, rows(300, 330));
  await expect(list.locator('[data-row-id="r329"]')).toBeInViewport();
  await expect.poll(async () => { const s = await scroll(page); return s.max - s.top; }).toBeLessThan(2);
  await page.screenshot({ path: path.join(shots, "virtual-list-end.png") });

  // Scrolled up, new rows do not move the view.
  const middle = await chatRow(page, "r150");
  const before = await middle.boundingBox();
  const top = (await scroll(page)).top;
  const height = await list.evaluate((el) => el.scrollHeight);
  appendFileSync(fixture, rows(330, 360));
  // The new rows are in when the list is taller.
  await expect.poll(() => list.evaluate((el) => el.scrollHeight)).toBeGreaterThan(height);
  await chatSettled(page);
  expect((await scroll(page)).top).toBe(top);
  expect((await middle.boundingBox())?.y).toBe(before?.y);

  // A row above the viewport that opens does not move the rows on screen.
  const below = await chatRow(page, "r160");
  await below.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await chatSettled(page);
  const y = (await below.boundingBox())?.y;
  const chip = list.locator('[data-row-id="r158"]').getByRole("button", { name: /Ran command 158/ });
  await chip.evaluate((el) => (el as HTMLElement).click());
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await chatSettled(page);
  expect((await below.boundingBox())?.y).toBeCloseTo(y!, 0);
  await page.screenshot({ path: path.join(shots, "virtual-list-middle.png") });
  await app.close();
});

test("chatRow finds a row while the list still pulls itself to its end", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const list = chatList(page);
  await list.locator("[role=listitem]").first().waitFor();
  // As Legend List does while it settles at start: for 3 s, a scroll away from the end goes back to the end on the next frame.
  await list.evaluate((el) => {
    const end = performance.now() + 3000;
    el.addEventListener("scroll", () => {
      if (performance.now() < end) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight }));
    });
  });
  // sep-1 is the first row: it is in the DOM only near the top.
  await expect(await chatRow(page, "sep-1")).toHaveText("14:05");
  await app.close();
});
