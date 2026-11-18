import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

// Issue #184: an answer's tool calls in one line, the answer footer, the compaction line. All text is the helper's.
test("tool calls fold into one line that opens to one line per call; the footer and the compaction line", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const tools = await chatRow(page, "a2-t1");
  const fold = tools.getByRole("button", { name: "Edited 2 files, ran 2 commands" });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(tools.getByRole("listitem")).toHaveCount(0);
  // Enter opens it, Enter again closes it: the keys of a button.
  await fold.focus();
  await page.keyboard.press("Enter");
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  const calls = tools.getByRole("list", { name: "Edited 2 files, ran 2 commands calls" }).getByRole("listitem");
  await expect(calls).toHaveText([
    "src/auth/useLoginForm.ts",
    "src/auth/LoginForm.test.tsx",
    "pnpm test auth✕1 failed",
    "pnpm test auth12 passed",
  ]);
  await expect(calls.nth(2).getByRole("img", { name: "failed" })).toBeVisible();
  const footer = await chatRow(page, "f-a3");
  await expect(footer).toHaveText("14:06 · Worked 1m 0s · 6 tools");
  const compacted = await chatRow(page, "st-1");
  await expect(compacted).toHaveText("Context compacted");

  // Colors from the tokens: the fold line and the footer in dim, the call in ink-85, the compaction line on a hairline.
  const color = (l: ReturnType<typeof page.locator>) => l.evaluate((e) => getComputedStyle(e).color);
  const p = footer.locator("p");
  const hair = compacted.locator("span").first();
  expect(await color(fold)).toBe("rgba(255, 255, 255, 0.5)");
  expect(await color(calls.nth(0).locator("span").first())).toBe("rgba(255, 255, 255, 0.85)");
  expect(await color(p)).toBe("rgba(255, 255, 255, 0.5)");
  expect(await hair.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(255, 255, 255, 0.06)");
  // The time line is on a hairline too: the mock's `.fold`.
  const sep = await chatRow(page, "sep-1");
  expect(await sep.locator("span").first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(255, 255, 255, 0.06)");
  expect(await p.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("JetBrains Mono");
  await page.mouse.move(0, 0);
  await fold.blur();
  await tools.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "tool-calls-dark.png") });
  // The middle of the list, so the ↓ button does not cover the line.
  const middle = () => compacted.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await middle();
  await expect(compacted).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: path.join(shots, "compaction-dark.png") });

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => color(fold)).toBe("rgba(0, 0, 0, 0.584)");
  expect(await color(p)).toBe("rgba(0, 0, 0, 0.584)");
  await middle();
  await page.screenshot({ path: path.join(shots, "compaction-light.png") });
  await tools.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "tool-calls-light.png") });

  await fold.focus();
  await page.keyboard.press("Enter");
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await app.close();
});
