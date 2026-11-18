import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// Keys go through Playwright's page keyboard (into the page only): no OS-level keys or mouse.
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

async function open(card?: string) {
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "answers.jsonl");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_TERMINAL: "t7",
    ...(card ? { FAKE_HELPER_CARD: path.join(e2e, `fixtures/cards/${card}.json`) } : {}),
    FAKE_HELPER_ANSWER_LOG: log,
  });
  const page = await app.firstWindow();
  const answers = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []);
  return { app, page, answers };
}

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test("a 1 typed in the reply box with a permission card shown stays text; a 1 with the focus on the page answers", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("bash-permission");
  const card = page.getByRole("region", { name: "Approval" });
  await expect(card.getByRole("button", { name: /Allow once/ })).toHaveAttribute("aria-keyshortcuts", "1 Enter");
  await expect(card.getByRole("button", { name: /Deny/ })).toHaveAttribute("aria-keyshortcuts", "2");
  const reply = page.getByRole("textbox", { name: /Reply to/ });
  await reply.focus();
  await page.keyboard.type("1");
  await expect(reply).toHaveValue("1");
  await page.waitForTimeout(300);
  await expect(card.getByRole("status")).toHaveCount(0);
  expect(answers()).toEqual([]);
  await shoot(page, "keys-card-reply-text");
  await blur(page);
  await page.keyboard.press("1");
  await expect(card).toContainText("Answer sent. Waiting for the agent.");
  await expect(reply).toHaveValue("1");
  expect(answers()).toEqual([{ cmd: "approve", terminal: "t7", request: "toolu_01HxQ7bVf3kPz9Ns2RtLmW4d", allow: true }]);
  await app.close();
});

test("a number key in the own-answer box or an open menu is text, and Enter on a focused chip opens the chip", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("multi-question");
  const card = page.getByRole("region", { name: "Question" });
  await expect(card.getByRole("button", { name: /Typecheck/ })).toHaveAttribute("aria-keyshortcuts", "1");
  await expect(card.getByRole("button", { name: "Next" })).toHaveAttribute("aria-keyshortcuts", "Enter");
  const own = card.getByRole("textbox", { name: "Own answer" });
  await expect(own).toHaveAttribute("aria-keyshortcuts", "4");
  await own.focus();
  await page.keyboard.type("2");
  await expect(own).toHaveValue("2");
  await expect(card.getByRole("button", { name: /Lint/ })).toHaveAttribute("aria-pressed", "false");
  // The model menu: its typeahead keeps the number key.
  await page.getByRole("button", { name: "Model" }).click();
  await expect(page.getByRole("menu", { name: "Model" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=menu]"))).toBe(true);
  await page.keyboard.press("1");
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: /Typecheck/ })).toHaveAttribute("aria-pressed", "false");
  // Enter on a tool chip opens it; the question does not go on.
  const chip = page.getByRole("button", { name: "Read 1 file" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await expect(card).toContainText("Checks · 1 of 2");
  // With the focus on the page the keys answer.
  await blur(page);
  await page.keyboard.press("1");
  await expect(card.getByRole("button", { name: /Typecheck/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(card).toContainText("Branch · 2 of 2");
  expect(answers()).toEqual([]);
  await app.close();
});

test("Tab goes from the top bar to the card and the reply box before the chat rows", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open("bash-permission");
  const reply = page.getByRole("textbox", { name: /Reply to/ });
  await expect(page.getByRole("region", { name: "Approval" })).toBeVisible();
  await page.getByRole("button", { name: "Terminal" }).focus();
  const stops: string[] = [];
  for (let i = 0; i < 6 && !(await reply.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return `${el.closest('[aria-label="Chat"]') ? "row " : ""}${el.getAttribute("aria-label") ?? el.textContent}`;
    }));
  }
  expect(stops).toEqual(["1Allow once", "2Deny", "Orchestrate", "Reply to Chat panel usability audit"]);
  // The reply box still shows under the chat rows.
  const list = (await page.getByRole("list", { name: "Chat" }).boundingBox())!;
  const box = (await reply.boundingBox())!;
  expect(box.y).toBeGreaterThan(list.y + list.height - 1);
  await shoot(page, "keys-reply-focus");
  await app.close();
});

test("a code block is a Tab stop only when it scrolls sideways", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open();
  const pres = page.locator('[aria-label="Chat"] .chat-markdown-codeblock pre');
  await expect(pres.first()).toBeVisible();
  const state = () => pres.evaluateAll((all) => all.map((p) => ({ stop: p.getAttribute("tabindex") === "0", scrolls: p.scrollWidth > p.clientWidth })));
  await expect.poll(async () => (await state()).every((p) => p.stop === p.scrolls)).toBe(true);
  expect((await state()).some((p) => p.stop)).toBe(false);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(640, 600));
  await expect.poll(async () => {
    const blocks = await state();
    // Each block updates its Tab stop in its own resize callback (#174).
    return blocks.some((p) => p.stop) && blocks.every((p) => p.stop === p.scrolls);
  }).toBe(true);
  // The block that scrolls can take the focus.
  await pres.and(page.locator("[tabindex='0']")).first().focus();
  await shoot(page, "keys-code-scroll");
  await app.close();
});
