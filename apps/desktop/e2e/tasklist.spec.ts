import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

// The mock's `.chk` (docs/design/redesign/screens.html): 14 px, radius 4, an ink-35 ring; on: an ink-85 fill, no ring.
test("task-list boxes are the mock's check boxes, from theme tokens", async () => {
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
  // `--ink-85` and `--ink-35` of the design-system tokens (tokens.css). Chromium keeps alpha in 8 bits.
  const want = {
    dark: { on: "rgba(255, 255, 255, 0.85)", ring: "rgba(255, 255, 255, 0.35) 0px 0px 0px 1px inset" },
    light: { on: "rgba(0, 0, 0, 0.835)", ring: "rgba(0, 0, 0, 0.443) 0px 0px 0px 1px inset" },
  };
  const style = (el: HTMLElement) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow, size: `${s.width} ${s.height}`, radius: s.borderTopLeftRadius };
  };
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect.poll(() => checked.evaluate(style)).toEqual({ bg: want[scheme].on, shadow: "none", size: "14px 14px", radius: "4px" });
    expect(await empty.evaluate(style)).toEqual({ bg: "rgba(0, 0, 0, 0)", shadow: want[scheme].ring, size: "14px 14px", radius: "4px" });
    // The answer's headings: the mock's `.col h3`, 14/20 px, weight 500, ink-100.
    const h = await row.locator("h2, h3").first().evaluate((e) => {
      const s = getComputedStyle(e);
      return `${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.color}`;
    });
    expect(h).toBe(`14px/20px 500 ${scheme === "dark" ? "rgb(244, 244, 245)" : "rgb(20, 20, 20)"}`);
    // The scheme change can lay out the rows again: find the row again before the screenshot.
    await chatRow(page, "a5");
    await row.screenshot({ path: path.join(shots, `tasklist-${scheme}.png`) });
  }
  await app.close();
});
