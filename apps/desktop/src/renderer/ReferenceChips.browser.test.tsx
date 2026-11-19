import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots, chatRow } from "../../test/273-chatRows";
import { draftRef } from "../../test/280-browser";
import { renderApp } from "../../test/renderApp";
import type { ContrApi, RefState } from "../shared/api";

const refs: Record<number, RefState | null> = {
  9: { kind: "issue", state: "closed", url: "https://github.com/o/r/issues/9" },
  12: { kind: "pr", state: "merged", url: "https://github.com/o/r/pull/12", checks: { state: "pass", passed: 6, failed: 0, total: 6 } },
  14: { kind: "pr", state: "open", url: "https://github.com/o/r/pull/14", checks: { state: "fail", passed: 5, failed: 1, total: 6 } },
  15: draftRef,
  20: { kind: "pr", state: "closed", url: "https://github.com/o/r/pull/20" },
  21: { kind: "issue", state: "open", url: "https://github.com/o/r/issues/21" },
  22: { kind: "issue", state: "not-planned", url: "https://github.com/o/r/issues/22" },
  99: null,
};

test("PR and issue numbers show their state, check marks, selection and links", async () => {
  const openRef = vi.fn<ContrApi["openRef"]>().mockResolvedValue(undefined);
  await renderApp(transcript, null, {
    refs: async (numbers) => Object.fromEntries(numbers.map((number) => [number, refs[number] ?? null])),
    openRef,
  });
  const row = await chatRow("a6");
  const chips = () => Array.from(row.querySelectorAll("[data-ref-state]"));
  await expect.poll(() => chips().length).toBe(9);
  const all = chips();
  const label = "[data-slot=context-chip-label]";
  expect(all.map((chip) => `${chip.querySelector(label)?.textContent} ${chip.getAttribute("data-ref-kind")} ${chip.getAttribute("data-ref-state")}`)).toEqual([
    "#12 pr merged", "#14 pr open", "#15 pr draft", "#20 pr closed",
    "#9 issue closed", "#21 issue open", "#22 issue not-planned", "#21 issue open", "#14 pr open",
  ]);
  const mark = (n: number) => all[n].querySelector("[data-checks]")!;
  expect([0, 1, 2].map((n) => mark(n).textContent)).toEqual(["✓ 6/6", "✕ 1", " 4/6"]);
  expect(mark(2).querySelectorAll('[data-state="working"]')).toHaveLength(1);
  expect(all[3].querySelectorAll("[data-checks]")).toHaveLength(0);
  expect(all.slice(0, 3).map((chip) => chip.getAttribute("aria-label"))).toEqual([
    "PR #12, Merged, 6 of 6 checks passed", "PR #14, Open, 1 of 6 checks failed", "PR #15, Draft, checks running, 4 of 6 passed",
  ]);
  const ink = (n: number) => getComputedStyle(all[n]).color;
  const markInk = (n: number) => getComputedStyle(mark(n)).color;
  expect([markInk(0), markInk(2)]).toEqual([ink(3), ink(3)]);
  expect(markInk(1)).toBe("rgb(244, 244, 245)");
  expect(row.querySelector(`li [data-ref-state] ${label}`)?.textContent).toBe("#21");
  expect(row.querySelector(`td [data-ref-state] ${label}`)?.textContent).toBe("#14");
  expect(row.querySelector("code[data-inline-code]")?.textContent).toBe("#12");
  expect(row.querySelectorAll("pre [data-ref-state]")).toHaveLength(0);
  expect(row.querySelector('a[href="https://example.com/x"]')?.textContent).toBe("#12");
  await expect.element(page.elementLocator(row).getByText(/#99 is not known/)).toBeVisible();

  const color = (n: number) => getComputedStyle(all[n].querySelector("svg")!).color;
  expect([0, 1, 3, 6].map(color)).toEqual(["rgb(171, 125, 248)", "rgb(63, 185, 80)", "rgb(145, 152, 161)", "rgb(145, 152, 161)"]);
  expect([0, 1, 3, 6].map(ink)).toEqual(["rgb(244, 244, 245)", "rgb(244, 244, 245)", "rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0.5)"]);
  expect(getComputedStyle(all[0]).boxShadow).toContain("color(srgb 0.670588 0.490196 0.972549 / 0.38) 0px 0px 0px 1px inset");
  expect(getComputedStyle(all[3]).boxShadow).toContain("color(srgb 0.568627 0.596078 0.631373 / 0.38) 0px 0px 0px 1px inset");

  const range = document.createRange();
  range.selectNodeContents(row.querySelector("p")!);
  const selection = getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  expect(selection.toString()).toContain("Merged in #12, open in #14, a draft in #15, and #20 was closed.");
  selection.removeAllRanges();
  await page.elementLocator(all[0]).click();
  expect(openRef.mock.calls).toEqual([["https://github.com/o/r/pull/12"]]);

  await commands.resetPointer();
  const view = page.elementLocator(row);
  await view.screenshot({ path: `${browserShots}/chips-dark.png` });
  await commands.colorScheme("light");
  await expect.poll(() => color(0)).toBe("rgb(130, 80, 223)");
  expect([ink(0), ink(3)]).toEqual(["rgb(20, 20, 20)", "rgba(0, 0, 0, 0.584)"]);
  expect([markInk(0), markInk(2)]).toEqual([ink(3), ink(3)]);
  expect(markInk(1)).toBe(ink(0));
  await view.screenshot({ path: `${browserShots}/chips-light.png` });
  expect((await chatRow("u1")).querySelectorAll("[data-ref-state]")).toHaveLength(0);
});
