import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("contr-flow and contr-seq draw; a block past a limit shows as code", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/diagrams-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const row = page.locator("ol[aria-label=Chat] > li").last();

  const flow = row.locator('[data-diagram="contr-flow"]');
  await expect(flow.locator("[data-node]")).toHaveCount(4);
  expect(await flow.locator("[data-node]").allTextContents()).toEqual(["issue", "build", "review", "merge"]);
  await expect(flow.locator('[data-node="review"]')).toHaveAttribute("data-state", "waiting");
  await expect(flow.locator("[data-edge] text")).toHaveText(["plan", "PR", "blockers", "green"]);

  const seq = row.locator('[data-diagram="contr-seq"]');
  expect(await seq.locator("[data-actor]").allTextContents()).toEqual(["owner", "lead", "b-696"]);
  await expect(seq.locator("[data-message] text")).toHaveText(["fix #696", "build it", "run the tests", "PR open"]);
  await expect(seq.locator("[data-reply]")).toHaveCount(1);

  const code = row.locator('.chat-markdown-codeblock[data-language="contr-flow"]');
  await expect(code).toContainText("a -> b -> c");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `diagrams-${scheme}.png`), fullPage: true });
  }
  await app.close();
});
