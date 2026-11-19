import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots, chatRow } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";

// The mock's `.chk` (docs/design/redesign/screens.html): 14 px, radius 4, an ink-35 ring; on: an ink-85 fill, no ring.
test("task-list boxes are the mock's check boxes, from theme tokens", async () => {
  await renderApp(transcript);
  // `--ink-85` and `--ink-35` of the design-system tokens (tokens.css). Chromium keeps alpha in 8 bits.
  const want = {
    dark: { on: "rgba(255, 255, 255, 0.85)", ring: "rgba(255, 255, 255, 0.35) 0px 0px 0px 1px inset" },
    light: { on: "rgba(0, 0, 0, 0.835)", ring: "rgba(0, 0, 0, 0.443) 0px 0px 0px 1px inset" },
  };
  const style = (el: Element) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow, size: `${s.width} ${s.height}`, radius: s.borderTopLeftRadius };
  };
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    const row = await chatRow("a5");
    const checked = row.querySelector("li.task-list-item input:checked")!;
    const empty = row.querySelector("li.task-list-item input:not(:checked)")!;
    await expect.poll(() => style(checked)).toEqual({ bg: want[scheme].on, shadow: "none", size: "14px 14px", radius: "4px" });
    expect(style(empty)).toEqual({ bg: "rgba(0, 0, 0, 0)", shadow: want[scheme].ring, size: "14px 14px", radius: "4px" });
    // The answer's headings: the mock's `.col h3`, 14/20 px, weight 500, ink-100.
    const s = getComputedStyle(row.querySelector("h2, h3")!);
    expect(`${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.color}`).toBe(`14px/20px 500 ${scheme === "dark" ? "rgb(244, 244, 245)" : "rgb(20, 20, 20)"}`);
    await page.elementLocator(row).screenshot({ path: `${browserShots}/tasklist-${scheme}.png` });
  }
});
