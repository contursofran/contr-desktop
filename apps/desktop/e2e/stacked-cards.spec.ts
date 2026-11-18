import { expect, test, type Page } from "@playwright/test";
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

/** The agent's card `card` and the owner items of fixtures/owner/open.json (two questions and two to-dos for t7). */
async function open(card: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const owner = path.join(dir, "open.json");
  copyFileSync(path.join(e2e, "fixtures/owner/open.json"), owner);
  const log = path.join(dir, "answers.jsonl");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_TERMINAL: "t7",
    FAKE_HELPER_CARD: path.join(e2e, `fixtures/cards/${card}.json`),
    FAKE_HELPER_ANSWER_LOG: log,
    FAKE_ORCH_OWNER: owner,
  });
  const page = await app.firstWindow();
  const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean) : []);
  return { app, page, answers: () => read(log).map((l) => JSON.parse(l)), ownerRuns: () => read(`${owner}.log`) };
}

// Sends a key to the page's DOM (no OS-level keys: e2e must not take the owner's input).
const key = (page: Page, k: string) => page.evaluate((k) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })), k);

test("with the agent's card and an owner question, key 1 answers only the agent's card", async () => {
  test.setTimeout(60_000);
  const { app, page, answers, ownerRuns } = await open("bash-permission");
  const approval = page.getByRole("region", { name: "Approval" });
  const q = page.getByRole("region", { name: "Owner question" });
  await expect(approval).toBeVisible();
  await expect(q).toContainText("D7 · The coordinator asks");
  // The agent's card owns the keys: the owner question shows no key badges.
  await expect(approval.getByRole("button")).toHaveText(["1Allow once", "2Deny"]);
  await expect(q.getByRole("radio")).toHaveText(["Oldest first · recommendedMatches the design; nothing waits forever.", "Newest firstNew work shows at once; old items wait."]);
  await key(page, "1");
  await expect(approval).toContainText("Answer sent. Waiting for the agent.");
  expect(answers()).toEqual([{ cmd: "approve", terminal: "t7", request: "toolu_01HxQ7bVf3kPz9Ns2RtLmW4d", allow: true }]);
  // The owner tool gets no answer; the owner question stays open.
  await page.waitForTimeout(1000);
  expect(ownerRuns()).toEqual([]);
  await expect(q).toContainText("D7 · The coordinator asks");
  await app.close();
});

/** The chat list, the reply box and the cards block, measured in the window. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => el?.getBoundingClientRect();
    const reply = box(document.querySelector("textarea"))!;
    const list = box(document.querySelector('[aria-label="Chat"]'))!;
    const cards = document.querySelector('[aria-label="Cards"]')!;
    return { height: window.innerHeight, list: list.height, replyTop: reply.top, replyBottom: reply.bottom, cards: cards.getBoundingClientRect().height, scrolls: cards.scrollHeight > cards.clientHeight };
  });
}

for (const [width, height] of [[640, 480], [900, 600]] as const) {
  test(`three stacked cards in a ${width}x${height} window scroll inside; the reply box stays in the window`, async () => {
    test.setTimeout(60_000);
    const { app, page } = await open("question");
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [width, height]);
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(height);
    await expect(page.getByRole("region", { name: "Question", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Owner question" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Owner to-do" })).toBeVisible();
    await expect.poll(async () => (await layout(page)).scrolls).toBe(true);
    const l = await layout(page);
    expect(l.cards).toBeLessThanOrEqual(height * 0.45 + 1);
    expect(l.list).toBeGreaterThanOrEqual(120);
    expect(l.replyBottom).toBeLessThanOrEqual(height);
    // The agent's card owns the keys: it stays in view, next to the reply box.
    await expect(page.getByRole("region", { name: "Question", exact: true })).toBeInViewport({ ratio: 0.5 });
    // A taller reply box takes the room from the cards, not from the chat list.
    const reply = page.getByRole("textbox", { name: /Reply to/ });
    await reply.fill("one\ntwo\nthree\nfour\nfive\nsix");
    await expect.poll(async () => (await layout(page)).replyTop).toBeLessThan(l.replyTop - 40);
    const tall = await layout(page);
    expect(tall.list).toBeGreaterThanOrEqual(120);
    expect(tall.replyBottom).toBeLessThanOrEqual(height);
    await expect(reply).toBeInViewport();
    await app.close();
  });
}

test("screenshots of the stacked cards at 640x480 and 1440x900", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open("question");
  await expect(page.getByRole("region", { name: "Question", exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Chat"] [role=listitem]').first()).toBeVisible();
  for (const [width, height] of [[640, 480], [1440, 900]] as const) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [width, height]);
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(height);
    await expect(page.getByRole("region", { name: "Owner to-do" })).toBeVisible();
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({ path: path.join(shots, `stacked-cards-${width}-${scheme}.png`) });
    }
  }
  await app.close();
});
