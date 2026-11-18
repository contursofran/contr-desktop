import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("PR and issue numbers show as chips with gh's state", async () => {
  test.setTimeout(60_000);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const ghLog = path.join(tmp, "gh.jsonl");
  const openLog = path.join(tmp, "open.txt");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    CONTR_REPO_DIR: tmp,
    FAKE_GH_LOG: ghLog,
    CONTR_OPEN_LOG: openLog,
  });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const row = await chatRow(page, "a6");
  const chips = row.locator("[data-ref-state]");
  await expect(chips).toHaveCount(9);
  const seen = await chips.evaluateAll((els) => els.map((e) => `${e.querySelector("[data-slot=context-chip-label]")?.textContent} ${e.getAttribute("data-ref-kind")} ${e.getAttribute("data-ref-state")}`));
  expect(seen).toEqual([
    "#12 pr merged", "#14 pr open", "#15 pr draft", "#20 pr closed",
    "#9 issue closed", "#21 issue open", "#22 issue not-planned",
    "#21 issue open", "#14 pr open",
  ]);
  // The checks from gh: passed, failed and running, in the chip's label for screen readers.
  const mark = (n: number) => chips.nth(n).locator("[data-checks]");
  expect([await mark(0).textContent(), await mark(1).textContent(), await mark(2).textContent()]).toEqual(["✓ 6/6", "✕ 1", " 4/6"]);
  await expect(mark(2).locator('[data-state="working"]')).toHaveCount(1);
  await expect(chips.nth(3).locator("[data-checks]")).toHaveCount(0);
  expect(await chips.evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("aria-label")))).toEqual([
    "PR #12, Merged, 6 of 6 checks passed", "PR #14, Open, 1 of 6 checks failed", "PR #15, Draft, checks running, 4 of 6 passed",
  ]);
  expect(await mark(0).evaluate((e) => getComputedStyle(e).color)).toBe("rgba(255, 255, 255, 0.45)");
  expect(await mark(1).evaluate((e) => getComputedStyle(e).color)).toBe("rgb(244, 244, 245)");
  await expect(row.locator("li [data-ref-state] [data-slot=context-chip-label]")).toHaveText("#21");
  await expect(row.locator("td [data-ref-state] [data-slot=context-chip-label]")).toHaveText("#14");
  // Code, links and unknown numbers stay text.
  await expect(row.locator("code[data-inline-code]")).toHaveText("#12");
  await expect(row.locator("pre [data-ref-state]")).toHaveCount(0);
  await expect(row.locator('a[href="https://example.com/x"]')).toHaveText("#12");
  await expect(row.getByText("#99 is not known")).toBeVisible();
  // The icon and the outline take the state token; the number stays in ink. A closed PR is grey, not red.
  const color = (n: number) => chips.nth(n).locator("svg").evaluate((e) => getComputedStyle(e).color);
  const ink = (n: number) => chips.nth(n).evaluate((e) => getComputedStyle(e).color);
  const outline = (n: number) => chips.nth(n).evaluate((e) => getComputedStyle(e).boxShadow);
  expect([await color(0), await color(1), await color(3), await color(6)]).toEqual(["rgb(171, 125, 248)", "rgb(63, 185, 80)", "rgb(145, 152, 161)", "rgb(145, 152, 161)"]);
  expect([await ink(0), await ink(1), await ink(3), await ink(6)]).toEqual(["rgb(244, 244, 245)", "rgb(244, 244, 245)", "rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0.5)"]);
  expect(await outline(0)).toContain("color(srgb 0.670588 0.490196 0.972549 / 0.38) 0px 0px 0px 1px inset");
  expect(await outline(3)).toContain("color(srgb 0.568627 0.596078 0.631373 / 0.38) 0px 0px 0px 1px inset");
  // gh: one batched call, never twice for a number within a minute.
  const calls = readFileSync(ghLog, "utf8").trim().split("\n").map((l) => JSON.parse(l) as number[]);
  expect(calls.flat().sort((a, b) => a - b)).toEqual([...new Set(calls.flat())].sort((a, b) => a - b));
  expect(calls.flat()).toEqual(expect.arrayContaining([9, 12, 14, 15, 20, 21, 22, 99]));
  // Selection across a chip copies its number.
  const selected = await row.locator("p").nth(0).evaluate((p) => {
    const range = document.createRange();
    range.selectNodeContents(p);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    return getSelection()!.toString();
  });
  expect(selected).toContain("Merged in #12, open in #14, a draft in #15, and #20 was closed.");
  await page.evaluate(() => getSelection()!.removeAllRanges());
  // A click opens the PR in the browser (e2e logs the URL instead).
  await chips.nth(0).click();
  await expect.poll(() => { try { return readFileSync(openLog, "utf8"); } catch { return ""; } }).toBe("https://github.com/o/r/pull/12\n");
  await page.mouse.move(0, 0);
  await row.scrollIntoViewIfNeeded();
  await row.screenshot({ path: path.join(shots, "chips-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => color(0)).toBe("rgb(130, 80, 223)");
  expect([await ink(0), await ink(3)]).toEqual(["rgb(20, 20, 20)", "rgba(0, 0, 0, 0.584)"]);
  await row.screenshot({ path: path.join(shots, "chips-light.png") });
  // The owner's own text stays plain.
  await expect((await chatRow(page, "u1")).locator("[data-ref-state]")).toHaveCount(0);
  await app.close();
});
