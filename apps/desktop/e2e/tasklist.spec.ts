import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("task-list boxes take their colors from theme tokens", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "a5");
  const checked = row.locator('li.task-list-item input:checked').first();
  const empty = row.locator('li.task-list-item input:not(:checked)').first();
  // `working` is `--ink-100` of the design-system tokens (tokens.css).
  const working = { dark: ["#f4f4f5", "rgb(244, 244, 245)"], light: ["#141414", "rgb(20, 20, 20)"] };
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-working").trim());
    const style = (el: HTMLElement) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor });
    const c = await checked.evaluate(style);
    const e = await empty.evaluate(style);
    expect(token).toBe(working[scheme][0]);
    expect(c.bg).toBe(working[scheme][1]);
    expect(e.bg).not.toBe(c.bg);
    expect(e.border).not.toBe(e.bg);
    // The scheme change can lay out the rows again: find the row again before the screenshot.
    await chatRow(page, "a5");
    await row.screenshot({ path: path.join(shots, `tasklist-${scheme}.png`) });
  }
  await app.close();
});
