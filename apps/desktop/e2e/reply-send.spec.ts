import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// A slow helper (FAKE_HELPER_SLOW_SEND, FAKE_HELPER_SLOW_FEED): what the owner types during a send stays, and the chat shows that it reads.
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const image = path.join(e2e, "fixtures/shot.png");

function launch(env: Record<string, string> = {}) {
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: log,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_E2E_PICK_IMAGE: image,
    ...env,
  });
  const sent = () => (!existsSync(log) ? [] : readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l).text as string));
  return { app, sent };
}

const replyBox = (page: Page) => page.getByRole("textbox", { name: /^Reply to/ });

test("text typed during a slow send stays in the box; only the sent text leaves", async () => {
  test.setTimeout(60_000);
  const { app: started, sent } = launch({ FAKE_HELPER_SLOW_SEND: "1500" });
  const app = await started;
  const page = await app.firstWindow();
  const box = replyBox(page);
  await box.fill("first message");
  await box.press("Enter");
  await box.press("End");
  await box.pressSequentially(" typed-during-send");
  await expect.poll(sent).toEqual(["first message"]);
  await expect(box).toHaveValue(" typed-during-send");
  await app.close();
});

test("Enter during a slow send queues the next message: both go, in order, and a second Enter on the same text sends nothing", async () => {
  test.setTimeout(60_000);
  const { app: started, sent } = launch({ FAKE_HELPER_SLOW_SEND: "1500" });
  const app = await started;
  const page = await app.firstWindow();
  const box = replyBox(page);
  await box.fill("one");
  await box.press("Enter");
  // The text that is on its way is no new message.
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await box.fill("two");
  await box.press("Enter");
  await expect.poll(sent, { timeout: 10_000 }).toEqual(["one", "two"]);
  await expect(box).toHaveValue("");
  await app.close();
});

test("an image attached during a slow send stays; the sent image leaves", async () => {
  test.setTimeout(60_000);
  const { app: started, sent } = launch({ FAKE_HELPER_SLOW_SEND: "1500" });
  const app = await started;
  const page = await app.firstWindow();
  const box = replyBox(page);
  const attachments = page.getByRole("list", { name: "Attachments" });
  await page.getByRole("button", { name: "Attach image" }).click();
  await box.fill("look");
  await box.press("Enter");
  await page.getByRole("button", { name: "Attach image" }).click();
  await expect(attachments.getByRole("img")).toHaveCount(2);
  await expect.poll(sent).toEqual([`look\n${image}`]);
  await expect(attachments.getByRole("img")).toHaveCount(1);
  await expect(box).toHaveValue("");
  await app.close();
});

test("a failed send keeps its text and the text queued after it, which does not go", async () => {
  test.setTimeout(60_000);
  const { app: started, sent } = launch({ FAKE_HELPER_SLOW_SEND: "1000", FAKE_HELPER_SEND_ERROR: "no_terminal" });
  const app = await started;
  const page = await app.firstWindow();
  const box = replyBox(page);
  await box.fill("one");
  await box.press("Enter");
  await box.press("End");
  await box.pressSequentially(" two");
  await box.press("Enter");
  await expect(page.getByRole("form", { name: "Reply" }).getByRole("alert")).toHaveText("Not sent: fake send error no_terminal");
  await page.waitForTimeout(1500);
  await expect(box).toHaveValue("one two");
  expect(sent()).toEqual([]);
  await app.close();
});

test("while the first feed answer has not come, the chat shows the loader and 'Reading the chat…'", async () => {
  test.setTimeout(60_000);
  const { app: started } = launch({ FAKE_HELPER_SLOW_FEED: "6000" });
  const app = await started;
  const page = await app.firstWindow();
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect(loading).toHaveText(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]Reading the chat…$/);
  await expect(page.getByRole("list", { name: "Chat" })).toHaveCount(0);
  // The rest of the window is ready; only the feed is slow.
  await expect(page.getByRole("button", { name: "Model" })).toHaveText("Opus 5.5medium");
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Chat panel usability audit");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `chat-loading-${scheme}.png`) });
  }
  await expect(page.getByRole("list", { name: "Chat" }).getByRole("listitem").first()).toBeVisible({ timeout: 20_000 });
  await expect(loading).toHaveCount(0);
  await app.close();
});
