import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import diagrams from "../../e2e/fixtures/diagrams-session.jsonl?raw";
import { browserShots, chatRow, normalizedText } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";

test("contr-flow and contr-seq draw; a block past a limit shows as code", async () => {
  await renderApp(diagrams);
  const row = await chatRow("r1");
  const tabs = page.getByRole("tablist", { name: "Tabs" }).getByRole("tab");
  await expect.poll(() => tabs.elements().map(normalizedText)).toEqual(["Chat panel usability audit"]);
  await expect.element(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  const flow = row.querySelector('[data-diagram="contr-flow"]')!;
  const nodes = flow.querySelectorAll("[data-node]");
  expect(nodes).toHaveLength(4);
  expect(Array.from(nodes, (node) => node.textContent)).toEqual(["✓issue", "build", "review", "merge"]);
  expect(flow.querySelector('[data-node="review"]')?.getAttribute("data-state")).toBe("waiting");
  expect(Array.from(flow.querySelectorAll("[data-edge] text"), normalizedText)).toEqual(["plan", "PR", "blockers", "green"]);
  // #190: steps go left to right, and a back arrow loops below the boxes, dashed, with its label under the curve.
  const rect = (name: string) => flow.querySelector(`[data-node="${name}"] rect`)!;
  const x = (name: string) => rect(name).getBoundingClientRect().x;
  expect(x("issue")).toBeLessThan(x("build"));
  expect(x("build")).toBeLessThan(x("review"));
  const backEdge = flow.querySelector('[data-edge="review->build"]')!;
  const curve = backEdge.querySelector("path")!;
  const curveBox = curve.getBBox();
  expect(backEdge.querySelector("text")!.getBBox().y).toBeGreaterThan(curveBox.y + curveBox.height);
  expect(curve.getAttribute("stroke-dasharray")).toBe("3 3");
  // #190: the running box is the brightest, with the status glyph; a done box has ✓ (the first name above).
  // #224: a box with no mark has no empty slot: its name starts where a mark would.
  const left = (name: string) => {
    const box = rect(name).getBoundingClientRect();
    const label = flow.querySelector(`[data-node="${name}"] text`)!.getBoundingClientRect();
    return Math.round(label.x - box.x);
  };
  expect(left("merge")).toBe(left("issue"));
  expect(getComputedStyle(rect("build")).stroke).not.toBe(getComputedStyle(rect("merge")).stroke);
  expect(flow.querySelector('[data-node="build"] .status-glyph')?.getAttribute("data-state")).toBe("working");
  expect(flow.querySelector('[data-node="review"] .status-glyph')?.getAttribute("data-state")).toBe("waiting");

  const seq = row.querySelector('[data-diagram="contr-seq"]')!;
  // F18: each diagram sits in the middle of its box.
  for (const diagram of [flow, seq]) {
    const box = diagram.getBoundingClientRect();
    const svg = diagram.querySelector("svg")!.getBoundingClientRect();
    expect(Math.abs(svg.x + svg.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
  }
  expect(Array.from(seq.querySelectorAll("[data-actor]"), (actor) => actor.textContent)).toEqual(["owner", "lead", "b-696"]);
  expect(Array.from(seq.querySelectorAll("[data-message] text"), normalizedText)).toEqual(["fix #696", "build it", "run the tests", "PR open", "D7 in the Inbox"]);
  expect(seq.querySelectorAll("[data-reply]")).toHaveLength(1);
  // #190: only the message to the owner is red (--blocked: #f07178 dark, #c73947 light).
  expect(seq.querySelectorAll("[data-owner]")).toHaveLength(1);
  for (const [scheme, red] of [["dark", "rgb(240, 113, 120)"], ["light", "rgb(199, 57, 71)"]] as const) {
    await commands.colorScheme(scheme);
    await expect.poll(() => getComputedStyle(seq.querySelector("[data-owner] text")!).fill).toBe(red);
  }

  const code = row.querySelector('.chat-markdown-codeblock[data-language="contr-flow"]')!;
  expect(normalizedText(code)).toContain("a -> b -> c");

  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await chatRow("r1");
    await page.screenshot({ path: `${browserShots}/diagrams-${scheme}.png` });
  }
});
