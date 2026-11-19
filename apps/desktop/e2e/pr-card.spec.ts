import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("contr-pr shows the PR from gh and its worker from the orchestration tool; a block with text stays code", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/pr-card-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    FAKE_ORCH_LIST: path.join(e2e, "fixtures/pr-card-workers.json"),
    CONTR_REPO_DIR: e2e,
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");

  const card = row.getByRole("region", { name: "PR #31" });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-pr-state", "open");
  await expect(card.getByRole("img", { name: "Open" })).toHaveCount(1);
  await expect(card).toContainText("#31Status board: parse contr-status into rows");
  await expect(card.getByTestId("pr-size")).toHaveText("+312 −40");
  // 312 of 352 lines are added: 4 of 5 boxes.
  await expect(card.locator("[data-box=a]")).toHaveCount(4);
  // b-31 of the chat's agent (t7), not the b-31 of t12.
  await expect(card.getByTestId("pr-meta")).toHaveText("agent/31-status-board → main·9 files·b-31·head a3f02b1");
  await expect(card.locator("[data-check]")).toHaveText([
    /^✓Typecheck38s$/,
    /^✓Lint21s$/,
    /^✓Unit1m 04s$/,
    /^✕e2e · keys\.spec\.ts:88 · Tab leaves the reply box4m 12s$/,
    /^e2e on the fix, a3f02b1running 2m$/,
  ]);
  await expect(card.locator("[data-check=running] [data-state=working]")).toHaveCount(1);
  await expect(card.getByTestId("pr-review")).toHaveText("Review: r-31, on a1c9e4f");
  await expect(card.getByTestId("pr-merge")).toHaveText("Merge: blocked");

  // The failed check is ink, not red: red is only for "needs you".
  await page.emulateMedia({ colorScheme: "dark" });
  const color = (sel: string) => card.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
  expect(await color("[data-check=fail]")).toBe("rgb(244, 244, 245)");
  expect(await color("[data-check=pass]")).toBe("rgba(255, 255, 255, 0.62)");

  // The block with text shows as code.
  await expect(row.locator("pre")).toContainText("not a number");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `pr-card-${scheme}.png`) });
  }
  await app.close();
});
