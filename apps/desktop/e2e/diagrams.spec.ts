import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("contr-flow and contr-seq draw; a block past a limit shows as code", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/diagrams-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    // t7 is in the sidebar: the tab and the reply box show its title, not "Terminal" (#119).
    FAKE_HC_AGENTS: "1",
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab")).toHaveText(["Chat panel usability audit"]);
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();

  const flow = row.locator('[data-diagram="contr-flow"]');
  await expect(flow.locator("[data-node]")).toHaveCount(4);
  expect(await flow.locator("[data-node]").allTextContents()).toEqual(["✓issue", "build", "review", "merge"]);
  await expect(flow.locator('[data-node="review"]')).toHaveAttribute("data-state", "waiting");
  await expect(flow.locator("[data-edge] text")).toHaveText(["plan", "PR", "blockers", "green"]);
  // #190: steps go left to right, and a back arrow loops below the boxes, dashed, with its label under the curve.
  const x = async (name: string) => (await flow.locator(`[data-node="${name}"] rect`).boundingBox())!.x;
  expect(await x("issue")).toBeLessThan(await x("build"));
  expect(await x("build")).toBeLessThan(await x("review"));
  const backEdge = await flow.locator('[data-edge="review->build"]').evaluate((g) => {
    const curve = g.querySelector("path")!;
    const [c, label] = [curve.getBBox(), g.querySelector("text")!.getBBox()];
    return { curveBottom: c.y + c.height, labelTop: label.y, dashed: curve.getAttribute("stroke-dasharray") };
  });
  expect(backEdge.labelTop).toBeGreaterThan(backEdge.curveBottom);
  expect(backEdge.dashed).toBe("3 3");
  // #190: the running box is the brightest, with the status glyph; a done box has ✓ (the first name above).
  // #224: a box with no mark has no empty slot: its name starts where a mark would.
  const left = async (name: string, sel: string) => {
    const [box, t] = [(await flow.locator(`[data-node="${name}"] rect`).boundingBox())!, (await flow.locator(`[data-node="${name}"] ${sel}`).first().boundingBox())!];
    return Math.round(t.x - box.x);
  };
  expect(await left("merge", "text")).toBe(await left("issue", "text"));
  const stroke = (name: string) => flow.locator(`[data-node="${name}"] rect`).evaluate((r) => getComputedStyle(r).stroke);
  expect(await stroke("build")).not.toBe(await stroke("merge"));
  await expect(flow.locator('[data-node="build"] .status-glyph')).toHaveAttribute("data-state", "working");
  await expect(flow.locator('[data-node="review"] .status-glyph')).toHaveAttribute("data-state", "waiting");
  // F18: each diagram sits in the middle of its box.
  for (const d of [flow, row.locator('[data-diagram="contr-seq"]')]) {
    const [box, svg] = [(await d.boundingBox())!, (await d.locator("svg").boundingBox())!];
    expect(Math.abs(svg.x + svg.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
  }

  const seq = row.locator('[data-diagram="contr-seq"]');
  expect(await seq.locator("[data-actor]").allTextContents()).toEqual(["owner", "lead", "b-696"]);
  await expect(seq.locator("[data-message] text")).toHaveText(["fix #696", "build it", "run the tests", "PR open", "D7 in the Inbox"]);
  await expect(seq.locator("[data-reply]")).toHaveCount(1);
  // #190: only the message to the owner is red (--blocked: #f07178 dark, #c73947 light).
  await expect(seq.locator("[data-owner]")).toHaveCount(1);
  for (const [scheme, red] of [["dark", "rgb(240, 113, 120)"], ["light", "rgb(199, 57, 71)"]] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(seq.locator("[data-owner] text")).toHaveCSS("fill", red);
  }

  const code = row.locator('.chat-markdown-codeblock[data-language="contr-flow"]');
  await expect(code).toContainText("a -> b -> c");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `diagrams-${scheme}.png`), fullPage: true });
  }
  await app.close();
});
