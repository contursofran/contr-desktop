import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
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
  const rows = page.locator("ol[aria-label=Chat] > li");
  await expect(rows).toHaveCount(15);
  await expect(rows.nth(1)).toContainText("The login form loses the email");
  await expect(rows.nth(3).getByRole("button")).toHaveText(["Searched 2 patterns›", "Read 1 file›"]);
  await expect(rows.nth(6)).toContainText("Opened PR #14");
  await expect(rows.nth(7)).toHaveText("14:06 · Worked 1m 0s · 6 tools");
  await expect(rows.nth(9)).toHaveText("↳ t2 docs-worker: Done: docs for the login form are updated in #15.");
  await expect(rows.nth(14)).toContainText("2 pictures");
  await expect(page.getByLabel("Status")).toContainText("Hashing…35s · ↓ 1.2k tokens");
  const ran = rows.nth(5).getByRole("button", { name: /Ran 2 commands/ });
  await ran.click();
  await expect(ran).toHaveAttribute("aria-expanded", "true");
  await expect(rows.nth(5)).toContainText("12 passed");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
  expect(bg).toBe("rgb(32, 32, 32)");
  await page.screenshot({ path: path.join(shots, "helper-rows.png") });
  await rows.last().scrollIntoViewIfNeeded();
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
