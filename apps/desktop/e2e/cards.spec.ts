import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const card = (name: string) => path.resolve(import.meta.dirname, `fixtures/cards/${name}.json`);

async function open(name: string, env: Record<string, string> = {}) {
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "answers.jsonl");
  const app = await launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_TERMINAL: "t7",
    FAKE_HELPER_CARD: card(name),
    FAKE_HELPER_ANSWER_LOG: log,
    ...env,
  });
  const page = await app.firstWindow();
  const answers = () => readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return { app, page, answers };
}

// Sends a key to the page's DOM (no OS-level keys: e2e must not take the owner's input).
const key = (page: Page, k: string) => page.evaluate((k) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })), k);

// The card sits between the chat and the reply box: the last chat row is fully visible above it.
async function lastRowAboveCard(page: Page) {
  const list = await page.getByRole("list", { name: "Chat" }).boundingBox();
  const last = await page.locator('ol[aria-label="Chat"] > li').last().boundingBox();
  const cardBox = await page.locator("section").last().boundingBox();
  expect(last && list && cardBox).toBeTruthy();
  expect(last!.y + last!.height).toBeLessThanOrEqual(cardBox!.y + 1);
  expect(last!.y + last!.height).toBeLessThanOrEqual(list!.y + list!.height + 1);
}

async function shoot(page: Page, name: string) {
  await lastRowAboveCard(page);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("a Bash permission card allows with key 1", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("bash-permission");
  const section = page.getByRole("region", { name: "Approval" });
  await expect(section).toContainText("Bash command");
  await expect(section).toContainText("pnpm --filter desktop exec playwright test e2e/app.spec.ts");
  await expect(section.getByRole("button")).toHaveText(["1Allow once", "2Deny"]);
  await shoot(page, "card-bash");
  // A key typed in the reply box stays there.
  await page.getByRole("textbox", { name: /Reply to/ }).focus();
  await key(page, "1");
  await page.waitForTimeout(300);
  await expect(section.getByRole("status")).toHaveCount(0);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await key(page, "1");
  await expect(section).toContainText("Answer sent. Waiting for the agent.");
  await expect(section.getByRole("button", { name: /Allow once/ })).toBeDisabled();
  expect(answers()).toEqual([{ cmd: "approve", terminal: "t7", request: "toolu_01HxQ7bVf3kPz9Ns2RtLmW4d", allow: true }]);
  await app.close();
});

test("an Edit permission card denies, and a changed prompt says so", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("edit-permission", { FAKE_HELPER_ANSWER_RESULT: "changed" });
  const section = page.getByRole("region", { name: "Approval" });
  await expect(section).toContainText("Edit file");
  await expect(section).toContainText("apps/desktop/src/renderer/chat/reply/ReplyBox.tsx");
  await shoot(page, "card-edit");
  await section.getByRole("button", { name: /Deny/ }).click();
  await expect(section).toContainText("It changed on screen. Here is what it shows now.");
  expect(answers()).toEqual([{ cmd: "approve", terminal: "t7", request: "toolu_01Kd8sYp2VwQe5Lr7JmNc3Tb", allow: false }]);
  await app.close();
});

test("a question card sends the pick of key 2", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("question");
  const section = page.getByRole("region", { name: "Question" });
  await expect(section).toContainText("Where should the draft text be kept?");
  await expect(section).toContainText("Memory only (Recommended)Lost when the window closes");
  await shoot(page, "card-question");
  await key(page, "2");
  await expect(section).toContainText("Answer sent. Waiting for the agent.");
  expect(answers()).toEqual([{ cmd: "answer", terminal: "t7", request: "toolu_01Ra4mVn6ZcX2bQ8tWy5Hk9p", answers: [{ picks: [1] }] }]);
  await app.close();
});

test("a multi-select question takes picks, then the next question's own answer", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("multi-question");
  const section = page.getByRole("region", { name: "Question" });
  await expect(section).toContainText("Checks · 1 of 2 · pick any");
  await key(page, "1");
  await key(page, "3");
  await expect(section.getByRole("button", { name: /Tests/ })).toHaveAttribute("aria-pressed", "true");
  await shoot(page, "card-multi");
  await key(page, "Enter");
  await expect(section).toContainText("Merge main into the branch first?");
  await key(page, "3");
  await expect(section.getByRole("textbox", { name: "Own answer" })).toBeFocused();
  await section.getByRole("textbox", { name: "Own answer" }).fill("Only after CI passes");
  await section.getByRole("button", { name: "Send" }).click();
  await expect(section).toContainText("Answer sent. Waiting for the agent.");
  expect(answers()).toEqual([{ cmd: "answer", terminal: "t7", request: "toolu_01Wm3Fq8Lz5Yt2Nd6Xc9Bv4s", answers: [{ picks: [0, 2] }, { picks: [], other: "Only after CI passes" }] }]);
  await app.close();
});
