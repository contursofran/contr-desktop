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
  const rows = page.locator("ol[aria-label=Chat] > li");
  await expect(rows).toHaveCount(13);
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

test("the reply box sends the typed text and pasted image", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch({ FAKE_HELPER_SEND_LOG: sendLog, FAKE_HELPER_PASTE_IMAGE: "/fake/paste/shot.png" });
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to claude" });
  await expect(box).toHaveAttribute("placeholder", "Reply to claude");
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
  const box = page.getByRole("textbox", { name: "Reply to claude" });
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
