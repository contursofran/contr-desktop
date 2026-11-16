import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("contr-status draws a board and contr-queue a queue; a bad block stays code", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/blocks-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_REPO_DIR: e2e,
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");

  const board = row.getByRole("list", { name: "Workers" });
  const workers = board.locator("> li");
  await expect(workers).toHaveCount(4);
  await expect(workers.nth(0)).toContainText("b-30");
  await expect(workers.nth(0)).toContainText("Status board");
  // The chat's agent (t7) has three live workers; the b-30 of t12 is not counted or shown.
  await expect(page.getByLabel("Status")).toContainText("Orchestrating · 3 workers");
  // Worker marks from the fake orch: working, blocked, idle, done.
  await expect(board.locator("[data-state]").first()).toBeVisible();
  for (const [i, state] of ["working", "blocked", "idle", "done"].entries()) {
    await expect(workers.nth(i).locator("[data-state]").first()).toHaveAttribute("data-state", state);
  }
  // PR checks from the fake gh: #31 pass, #41 running, #51 fail, #60 no PR.
  const checks = board.getByTestId("pr-checks");
  await expect(checks).toHaveCount(3);
  await expect(checks.nth(0)).toContainText("#31");
  for (const [i, state] of ["done", "working", "blocked"].entries()) {
    await expect(checks.nth(i).locator("[data-state]")).toHaveAttribute("data-state", state);
  }
  await expect(workers.nth(3).getByTestId("pr-checks")).toHaveCount(0);

  const queue = row.getByRole("list", { name: "Merge order" });
  await expect(queue.locator("> li")).toHaveText([/1#70Parse the blocks$/, /2#31Status board\s*waits for #70/, /3#41Queue block\s*waits for #31/]);
  await expect(queue.locator('[data-ref-state="merged"]')).toHaveCount(1);

  // The block that does not parse shows as code.
  await expect(row.locator("pre")).toHaveCount(1);
  await expect(row.locator("pre")).toContainText("b-30 #30 no bars");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `blocks-${scheme}.png`), fullPage: true });
  }
  await app.close();
});
