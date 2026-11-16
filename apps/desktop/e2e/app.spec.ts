import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const fakeHelper = path.resolve(import.meta.dirname, "fake-helper.mjs");
const fixture = path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl");

function launch(env: Record<string, string> = {}) {
  return electron.launch({
    args: ["."],
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, CONTR_HELPER: fakeHelper, FAKE_HELPER_FIXTURE: fixture, CONTR_TERMINAL: "t7", ...env },
  });
}

test("the window shows the helper's rows", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch({ FAKE_HELPER_SEND_LOG: sendLog });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const rows = page.locator("ol[aria-label=Chat] > li");
  await expect(rows).toHaveCount(14);
  await expect(rows.nth(1)).toContainText("The login form loses the email");
  await expect(rows.nth(3)).toContainText("Searched 2 patterns, Read 1 file");
  await expect(rows.nth(6)).toContainText("Opened PR #14");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
  expect(bg).toBe("rgb(32, 32, 32)");
  await page.screenshot({ path: path.join(shots, "helper-rows.png") });

  expect(await page.evaluate(() => window.contr.send("hello"))).toEqual({ ok: true });
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({ terminal: "t7", text: "hello" });
  await app.close();
});

test("the window shows the helper's error", async () => {
  const app = await launch({ FAKE_HELPER_ERROR: "no-core" });
  const page = await app.firstWindow();
  await expect(page.getByRole("alert")).toHaveText("no-core: fake error no-core");
  await app.close();
});

test("assistant rows show as Markdown with code blocks and tables", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const answer = page.locator("ol[aria-label=Chat] > li").nth(13);
  await expect(answer.getByRole("heading", { name: "Remember-me test" })).toBeVisible();
  await expect(answer.locator("table tbody tr")).toHaveCount(3);
  await expect(answer.locator("td code").first()).toHaveText("src/auth/LoginForm.tsx");
  await expect(answer.locator("input[type=checkbox]")).toHaveCount(3);
  await expect(answer.locator("[data-language=tsx]")).toContainText("tsx");
  await expect(answer.locator("[data-language=sh]")).toContainText("pnpm test auth --watch=false");
  // The WASM highlighter colors the tokens.
  await expect(answer.locator("[data-language=tsx] .chat-markdown-shiki span[style]").first()).toBeVisible();

  await app.evaluate(({ clipboard }) => clipboard.clear());
  await answer.locator("[data-language=sh]").getByRole("button", { name: "Copy code" }).click();
  await expect(answer.locator("[data-language=sh]").getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe("pnpm test auth --watch=false");

  await page.setViewportSize({ width: 900, height: 1000 });
  await answer.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "markdown-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
  expect(bg).toBe("rgb(255, 255, 255)");
  await page.screenshot({ path: path.join(shots, "markdown-light.png") });
  await app.close();
});
