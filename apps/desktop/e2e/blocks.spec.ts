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
  // #190: a rail; the step number is at the right, and the note is under the label.
  await expect(queue.locator("> li")).toHaveText([/^#70 Parse the blocks1$/, /^#31 Status boardwaits for #702$/, /^#41 Queue blockwaits for #313$/]);
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
  }
  await app.close();
});
