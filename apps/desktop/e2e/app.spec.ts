import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

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
  await expect(await chatRow(page, "u1")).toContainText("After a rejected sign-in, the login form clears the email");

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
  await app.close();
});

test("the window shows the helper's error", async () => {
  const app = await launch({ FAKE_HELPER_ERROR: "no-core" });
  const page = await app.firstWindow();
  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect(alert.locator("p").first()).toHaveText("hc is not running.");
  await expect(alert.locator("pre")).toHaveText("no-core: fake error no-core");
  await app.close();
});

test("Copy code writes the command to the native clipboard", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  const answer = await chatRow(page, "a5");
  await app.evaluate(({ clipboard }) => clipboard.clear());
  await answer.locator("[data-language=sh]").getByRole("button", { name: "Copy code" }).click();
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe("pnpm test auth --watch=false");
  await app.close();
});
