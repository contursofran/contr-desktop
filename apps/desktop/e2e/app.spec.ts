import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatList, chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const fakeHelper = path.resolve(import.meta.dirname, "fake-helper.mjs");
const fakeHc = path.resolve(import.meta.dirname, "fake-hc.mjs");
const fixture = path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl");

function launch(env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: fakeHelper,
    FAKE_HELPER_FIXTURE: fixture,
    CONTR_TERMINAL: "t7",
    CONTR_HC: fakeHc,
    FAKE_HC_TITLE: "Chat panel usability audit",
    ...env,
  });
}

test("the window shows the helper's rows", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch({ FAKE_HELPER_SEND_LOG: sendLog });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  // The list opens at the end: the last row is on screen.
  await expect(chatList(page).locator('[data-row-id="a6"]')).toBeInViewport();
  await expect(page.getByRole("button", { name: /Running a command/ }).getByRole("status")).toBeVisible();
  await expect(await chatRow(page, "u1")).toContainText("The login form loses the email");
  const searched = await chatRow(page, "a1-t1");
  await expect(searched.getByRole("button")).toHaveText(["Searched 2 patterns", "Read 1 file"]);
  await expect(searched.locator("button svg.lucide-search")).toHaveCount(1);
  await expect(await chatRow(page, "a3")).toContainText("Opened PR #14");
  await expect(await chatRow(page, "f-a3")).toHaveText("14:06 · Worked 1m 0s · 6 tools");
  await expect(await chatRow(page, "u2")).toHaveText("↳ t2 docs-worker: Done: docs for the login form are updated in #15.");
  await expect(await chatRow(page, "u4")).toContainText("2 pictures");
  await expect(page.getByLabel("Status")).toContainText("Hashing…35s · ↓ 1.2k tokens");
  const tools = await chatRow(page, "a2-t1");
  const ran = tools.getByRole("button", { name: /Ran 2 commands/ });
  await ran.click();
  await expect(ran).toHaveAttribute("aria-expanded", "true");
  await expect(tools).toContainText("12 passed");
  await expect(tools).toContainText("failed");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
  expect(bg).toBe("rgb(32, 32, 32)");
  await chatRow(page, "u1");
  await page.screenshot({ path: path.join(shots, "helper-rows.png") });
  await chatRow(page, "a6");
  await page.screenshot({ path: path.join(shots, "helper-rows-end.png") });

  expect(await page.evaluate(() => window.contr.send("hello"))).toEqual({ ok: true });
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({ terminal: "t7", text: "hello" });
  await app.close();
});

test("the reply box sends the typed text and pasted image", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch({ FAKE_HELPER_SEND_LOG: sendLog, FAKE_HELPER_PASTE_IMAGE: "/fake/paste/shot.png" });
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  await expect(box).toHaveAttribute("placeholder", "Reply to Chat panel usability audit");
  await box.click();
  await page.keyboard.type("first line");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second line");
  await box.evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(["x"], "shot.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("list", { name: "Attachments" })).toHaveText("shot.png");
  await page.screenshot({ path: path.join(shots, "reply-box.png") });
  await page.keyboard.press("Enter");
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({
    terminal: "t7",
    text: "first line\nsecond line\n/fake/paste/shot.png",
  });
  await app.close();
});

test("the reply box shows an error when the send fails", async () => {
  const app = await launch({ FAKE_HELPER_SEND_ERROR: "no-terminal" });
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  await box.fill("hello");
  await box.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Not sent: fake send error no-terminal");
  await expect(box).toHaveValue("hello");
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
  const answer = await chatRow(page, "a5");
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
