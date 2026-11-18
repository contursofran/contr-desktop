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
    FAKE_HC_AGENTS: "1",
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_REPO_DIR: e2e,
    CONTR_TERMINAL: "t7",
    FAKE_ORCH_OWNER: path.join(e2e, "fixtures/owner/board.json"),
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
  // Steps from the tool's role and state, and gh: #31 checks pass, b-40 is blocked (its step is red),
  // #51 checks fail, b-60's PR #12 is merged.
  const steps = [
    ["CI passed", "Step: CI passed, 4 of 6 done"],
    ["asks you", "Step: asks you, 3 of 6 done"],
    ["CI fails", "Step: CI fails, 3 of 6 done"],
    ["merged", "Step: merged, 6 of 6 done"],
  ];
  for (const [i, [word, label]] of steps.entries()) {
    const step = workers.nth(i).locator("[data-step]");
    await expect(step).toHaveAttribute("data-step", word!);
    await expect(step).toHaveAttribute("aria-label", label!);
  }
  await expect(workers.nth(1).locator('[data-mark="now"]')).toHaveClass(/bg-blocked/);
  // b-40 waits for the owner: its item D7 (from b-40, this chat) in place of its PR. The PR chips carry gh's checks.
  await expect(workers.nth(1).getByLabel("Question D7, Queue block or row, open")).toBeVisible();
  const checks = board.getByTestId("pr-checks");
  await expect(checks).toHaveCount(3);
  await expect(checks.nth(0).getByRole("link")).toHaveAccessibleName("PR #31, Open, 6 of 6 checks passed");
  await expect(checks.nth(1).getByRole("link")).toHaveAccessibleName("PR #51, Open, 1 of 6 checks failed");
  await expect(checks.nth(2).getByRole("link")).toHaveAccessibleName("PR #12, Merged, 6 of 6 checks passed");

  // A `contr-status same` block: one line of worker chips.
  const same = (await chatRow(page, "r2")).getByTestId("board-same");
  await expect(same).toHaveText(/^Running, no change:\s*b-30\s*b-40$/);
  await expect(same.getByLabel("Worker b-40, blocked")).toBeVisible();

  const queue = row.getByRole("list", { name: "Merge order" });
  // #190: a rail; the step number is at the right, and the note is under the label. The PR chips carry gh's checks.
  await expect(queue.locator("> li")).toHaveText([/^#70 Parse the blocks1$/, /^#31✓ 6\/6 Status boardwaits for #702$/, /^#41.*4\/6 Queue blockwaits for #31✓ 6\/63$/]);
  await expect(queue.locator('> li > div > div:first-child [data-ref-state="merged"]')).toHaveCount(1);
  // Done, now, next from gh: #70 merged, #31 open, #41 draft. The #70 in the note is a chip too.
  await expect.poll(() => queue.locator("> li").evaluateAll((li) => li.map((l) => l.getAttribute("data-step")))).toEqual(["done", "now", "next"]);
  await expect(queue.locator("> li").nth(1).locator(".text-dim [data-ref-kind]")).toHaveText("#70");
  // #224: as the mock, now and next differ by the ring (ink-100 now, ink-50 next; Tailwind puts empty shadows first); the title is the same on each row.
  await page.emulateMedia({ colorScheme: "dark" });
  const ring = (i: number) => queue.locator("> li").nth(i).locator("> span").first();
  await expect(ring(1)).toHaveCSS("box-shadow", /rgb\(244, 244, 245\) 0px 0px 0px 1\.5px inset$/);
  await expect(ring(2)).toHaveCSS("box-shadow", /rgba\(255, 255, 255, 0\.5\) 0px 0px 0px 1\.5px inset$/);
  const title = (i: number) => queue.locator("> li").nth(i).locator("> div > div").first().evaluate((d) => [getComputedStyle(d).color, getComputedStyle(d).fontWeight]);
  expect(await title(1)).toEqual(await title(2));

  // The block that does not parse shows as code.
  await expect(row.locator("pre")).toHaveCount(1);
  await expect(row.locator("pre")).toContainText("b-30 #30 no bars");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `blocks-${scheme}.png`), fullPage: true });
    // In the middle of the chat: away from the top fade and the Chat or Terminal switch.
    await board.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await board.screenshot({ path: path.join(shots, `board-${scheme}.png`) });
    await same.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await same.screenshot({ path: path.join(shots, `board-same-${scheme}.png`) });
  }
  await app.close();
});
