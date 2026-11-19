import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots, chatRow, normalizedText } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";

// Issue #184: an answer's tool calls in one line, the answer footer, the compaction line. All text is the helper's.
test("tool calls fold into one line that opens to one line per call; the footer and the compaction line", async () => {
  await renderApp(transcript);
  await commands.colorScheme("dark");
  const tools = await chatRow("a2-t1");
  const fold = page.getByRole("list", { name: "Chat", exact: true }).getByRole("button", { name: "Edited 2 files, ran 2 commands" });
  await expect.element(fold).toHaveAttribute("aria-expanded", "false");
  expect(page.elementLocator(tools).getByRole("listitem").elements()).toHaveLength(0);
  // Enter opens it, Enter again closes it: the keys of a button.
  const button = fold.element() as HTMLButtonElement;
  button.focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(fold).toHaveAttribute("aria-expanded", "true");
  const calls = page.getByRole("list", { name: "Edited 2 files, ran 2 commands calls" }).getByRole("listitem");
  expect(calls.elements().map(normalizedText)).toEqual([
    "src/auth/useLoginForm.ts",
    "src/auth/LoginForm.test.tsx",
    "pnpm test auth✕1 failed",
    "pnpm test auth12 passed",
  ]);
  await expect.element(calls.nth(2).getByRole("img", { name: "failed" })).toBeVisible();
  const footer = await chatRow("f-a3");
  await expect.element(page.elementLocator(footer)).toHaveTextContent("14:06 · Worked 1m 0s · 7 tools");
  const compacted = await chatRow("st-1");
  await expect.element(page.elementLocator(compacted)).toHaveTextContent("Context compacted");

  // Colors from the tokens: the fold line and the footer in dim, the call in ink-85, the compaction line on a hairline.
  const p = footer.querySelector("p")!;
  const hair = compacted.querySelector("span")!;
  expect(getComputedStyle(button).color).toBe("rgba(255, 255, 255, 0.5)");
  expect(getComputedStyle(calls.nth(0).element().querySelector("span")!).color).toBe("rgba(255, 255, 255, 0.85)");
  expect(getComputedStyle(p).color).toBe("rgba(255, 255, 255, 0.5)");
  expect(getComputedStyle(hair).backgroundColor).toBe("rgba(255, 255, 255, 0.06)");
  // The time line is on a hairline too: the mock's `.fold`.
  const sep = await chatRow("sep-1");
  expect(getComputedStyle(sep.querySelector("span")!).backgroundColor).toBe("rgba(255, 255, 255, 0.06)");
  expect(getComputedStyle(p).fontFamily).toContain("JetBrains Mono");
  button.blur();
  await chatRow("a2-t1", "center");
  await page.screenshot({ path: `${browserShots}/tool-calls-dark.png` });
  // The middle of the list, so the ↓ button does not cover the line.
  const middle = () => chatRow("st-1", "center");
  await expect.element(page.elementLocator(await middle())).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `${browserShots}/compaction-dark.png` });

  await commands.colorScheme("light");
  await expect.poll(() => getComputedStyle(button).color).toBe("rgba(0, 0, 0, 0.584)");
  expect(getComputedStyle(p).color).toBe("rgba(0, 0, 0, 0.584)");
  await middle();
  await page.screenshot({ path: `${browserShots}/compaction-light.png` });
  await chatRow("a2-t1", "center");
  await page.screenshot({ path: `${browserShots}/tool-calls-light.png` });

  button.focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(fold).toHaveAttribute("aria-expanded", "false");
});
