import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, copyFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// The reply box takes the keyboard when the chat shows (docs/design/recipe-herdr.md, issue #141).
// The window never shows in e2e (launch.ts): a `focus` event sent to the page stands for "the window became active".
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

function launch(env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    ...env,
  });
}

const replyBox = (page: Page) => page.getByRole("textbox", { name: /^Reply to/ });
const row = (page: Page, name: RegExp) => page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name }).first();
const activate = (page: Page) => page.evaluate(() => window.dispatchEvent(new FocusEvent("focus")));
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test("the reply box takes the keyboard at start, on another agent's chat, back from Terminal, and when the window becomes active", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Chat panel usability audit");
  await expect(replyBox(page)).toBeFocused();

  await row(page, /Release notes draft/).click();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Release notes draft");
  await expect(replyBox(page)).toBeFocused();

  await page.getByRole("radio", { name: "Terminal", exact: true }).click();
  await expect(replyBox(page)).toHaveCount(0);
  await page.getByRole("radio", { name: "Chat", exact: true }).click();
  await expect(replyBox(page)).toBeFocused();

  await row(page, /Release notes draft/).focus();
  await activate(page);
  await expect(replyBox(page)).toBeFocused();
  await blur(page);
  await activate(page);
  await expect(replyBox(page)).toBeFocused();
  // Digits typed in the reply box are text.
  await page.keyboard.type("12");
  await expect(replyBox(page)).toHaveValue("12");
  await app.close();
});

test("the reply box does not take the keyboard from a selection in the chat or an open menu", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  await expect(replyBox(page)).toBeFocused();

  // A text selection in the chat stays.
  const first = page.getByRole("list", { name: "Chat" }).getByRole("listitem").first();
  await expect(first).toBeVisible();
  await first.evaluate((el) => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.getSelection()?.selectAllChildren(el);
  });
  const selected = () => page.evaluate(() => document.getSelection()?.toString() ?? "");
  const text = await selected();
  expect(text).not.toBe("");
  await activate(page);
  await expect(replyBox(page)).not.toBeFocused();
  expect(await selected()).toBe(text);

  // An open menu keeps the keyboard.
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await page.getByRole("button", { name: "Model" }).click();
  const menu = page.getByRole("menu", { name: "Model" });
  await expect(menu).toBeVisible();
  await expect(replyBox(page)).not.toBeFocused();
  await activate(page);
  await expect(menu).toBeVisible();
  await expect(replyBox(page)).not.toBeFocused();
  await app.close();
});

test("with a card that owns the card keys, the reply box leaves the keyboard: a 1 answers the card", async () => {
  test.setTimeout(60_000);
  const app = await launch({ FAKE_HELPER_CARD: path.join(e2e, "fixtures/cards/bash-permission.json") });
  const page = await app.firstWindow();
  const card = page.getByRole("region", { name: "Approval" });
  await expect(card).toBeVisible();
  await activate(page);
  await expect(replyBox(page)).not.toBeFocused();
  await page.keyboard.press("1");
  await expect(card).toContainText("Answer sent. Waiting for the agent.");
  await expect(replyBox(page)).toHaveValue("");
  await app.close();
});

// Issue #159: the first full answer comes late. A control that got the focus in between keeps it.
test("a late first answer leaves the focus on a button that took it while the chat was read", async () => {
  test.setTimeout(60_000);
  const fixture = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "session.jsonl");
  copyFileSync(path.join(e2e, "fixtures/claude-session.jsonl"), fixture);
  const app = await launch({ FAKE_HELPER_FIXTURE: fixture, FAKE_HELPER_SLOW_FEED: "6000" });
  const page = await app.firstWindow();
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect(loading).toBeVisible();
  const attachButton = page.getByRole("button", { name: "Attach image" });
  await attachButton.focus();
  // The focus moved before the first answer came.
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCount(0, { timeout: 20_000 });
  // The rows can show before the tick's card: a row of the next tick shows only after that card, when the box could take the keyboard.
  appendFileSync(fixture, `${JSON.stringify({ id: "late", k: "assistant", ts: 1793671080000, text: "Next tick." })}\n`);
  await expect(page.getByRole("list", { name: "Chat" })).toContainText("Next tick.", { timeout: 20_000 });
  await expect(attachButton).toBeFocused();
  await expect(replyBox(page)).not.toBeFocused();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `focus-late-button-${scheme}.png`) });
  }
  await app.close();
});

test("a late first answer gives the keyboard to the reply box when nothing has the focus", async () => {
  test.setTimeout(60_000);
  const app = await launch({ FAKE_HELPER_SLOW_FEED: "6000" });
  const page = await app.firstWindow();
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect(loading).toBeVisible();
  await page.getByRole("button", { name: "Attach image" }).focus();
  await blur(page);
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCount(0, { timeout: 20_000 });
  await expect(replyBox(page)).toBeFocused();
  await app.close();
});

test("a late first answer gives the keyboard to the reply box when the focus has not moved since the window became active", async () => {
  test.setTimeout(60_000);
  const app = await launch({ FAKE_HELPER_SLOW_FEED: "6000" });
  const page = await app.firstWindow();
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect(loading).toBeVisible();
  await row(page, /Release notes draft/).focus();
  await activate(page);
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCount(0, { timeout: 20_000 });
  await expect(replyBox(page)).toBeFocused();
  await app.close();
});
