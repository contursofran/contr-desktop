import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
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
  const answers = () => (existsSync(log) ? readFileSync(log, "utf8") : "").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { app, page, answers };
}

// Sends a key to the page's DOM (no OS-level keys: e2e must not take the owner's input).
const key = (page: Page, k: string) => page.evaluate((k) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })), k);

// The card sits between the chat and the reply box: the last chat row is fully visible above it.
// The list scrolls to its end after the card makes it shorter, so the check waits for that.
async function lastRowAboveCard(page: Page) {
  await expect(async () => {
    const list = await page.getByRole("list", { name: "Chat" }).boundingBox();
    const last = await page.locator('[aria-label="Chat"] [role=listitem]').last().boundingBox();
    const cardBox = await page.locator("section").last().boundingBox();
    expect(last && list && cardBox).toBeTruthy();
    expect(last!.y + last!.height).toBeLessThanOrEqual(cardBox!.y + 1);
    expect(last!.y + last!.height).toBeLessThanOrEqual(list!.y + list!.height + 1);
  }).toPass({ timeout: 5000 });
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
  // The card's key handler calls preventDefault when it takes a key: here it must not.
  expect(await key(page, "1")).toBe(true);
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
  await expect(section).toContainText("Memory only · recommendedLost when the window closes");
  await shoot(page, "card-question");
  await key(page, "2");
  await expect(section).toContainText("Answer sent. Waiting for the agent.");
  expect(answers()).toEqual([{ cmd: "answer", terminal: "t7", request: "toolu_01Ra4mVn6ZcX2bQ8tWy5Hk9p", answers: [{ picks: [1] }] }]);
  await app.close();
});

test("the agent radio group moves the pick with arrows and sends it with Enter", async () => {
  const { app, page, answers } = await open("question");
  const group = page.getByRole("radiogroup", { name: "Where should the draft text be kept?" });
  const first = group.getByRole("radio", { name: "Memory only · recommended", exact: true });
  const second = group.getByRole("radio", { name: "localStorage", exact: true });
  await expect(first).toBeChecked();
  await first.focus();
  await first.press("ArrowDown");
  await expect(second).toBeFocused();
  await expect(second).toBeChecked();
  await expect(first).not.toBeChecked();
  expect(answers()).toEqual([]);
  await second.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Answer sent. Waiting for the agent." })).toBeVisible();
  expect(answers()).toEqual([{ cmd: "answer", terminal: "t7", request: "toolu_01Ra4mVn6ZcX2bQ8tWy5Hk9p", answers: [{ picks: [1] }] }]);
  await app.close();
});

test("a multi-select question takes picks, then the next question's own answer", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("multi-question");
  const section = page.getByRole("region", { name: "Question" });
  await expect(section).toContainText("Checks · 1 of 2 · pick any");
  const group = section.getByRole("group", { name: "Which checks should run before the push?" });
  const lint = group.getByRole("checkbox", { name: "Lint", exact: true });
  await lint.press("Space");
  await expect(lint).toBeChecked();
  await lint.press("Space");
  await expect(lint).not.toBeChecked();
  await key(page, "1");
  await key(page, "3");
  await expect(section.getByRole("checkbox", { name: "Tests · recommended", exact: true })).toBeChecked();
  await shoot(page, "card-multi");
  await lint.blur();
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

test("Enter on a pick-any question with nothing picked does nothing; a one-choice question starts with its first answer picked", async () => {
  test.setTimeout(60_000);
  const { app, page, answers } = await open("multi-question");
  const section = page.getByRole("region", { name: "Question" });
  await expect(section).toContainText("Checks · 1 of 2 · pick any");
  await expect(section.getByRole("button", { name: "Next" })).toBeDisabled();
  await key(page, "Enter");
  await key(page, "Enter");
  await expect(section).toContainText("Checks · 1 of 2 · pick any");
  await key(page, "1");
  await expect(section.getByRole("button", { name: "Next" })).toBeEnabled();
  await key(page, "Enter");
  await expect(section).toContainText("Branch · 2 of 2");
  // The first answer is picked (screens.html `.opt.is-picked`): it has the hover fill, and Enter sends it.
  await page.emulateMedia({ colorScheme: "dark" });
  const yes = section.getByRole("radio", { name: "Yes · recommended", exact: true });
  await expect(yes).toBeChecked();
  // `--hover` in dark, rgba(255,255,255,0.045): Chromium rounds the alpha to 8 bits.
  await expect(yes).toHaveCSS("background-color", "rgba(255, 255, 255, 0.043)");
  await expect(section.getByRole("button", { name: "Send" })).toBeEnabled();
  await key(page, "Enter");
  await expect(section).toContainText("Answer sent. Waiting for the agent.");
  expect(answers()).toEqual([{ cmd: "answer", terminal: "t7", request: "toolu_01Wm3Fq8Lz5Yt2Nd6Xc9Bv4s", answers: [{ picks: [0] }, { picks: [0] }] }]);
  await app.close();
});

test("in a 900x600 window a card keeps 16 px of side space, as the chat rows do", async () => {
  const { app, page } = await open("question");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(900, 600));
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(900);
  const cardBox = page.getByRole("region", { name: "Question" });
  await expect(cardBox).toBeVisible();
  const main = (await page.locator("main").boundingBox())!;
  const b = (await cardBox.boundingBox())!;
  expect(b.x - main.x).toBeGreaterThanOrEqual(16);
  expect(main.x + main.width - (b.x + b.width)).toBeGreaterThanOrEqual(16);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `card-narrow-${scheme}.png`) });
  }
  await app.close();
});

// The one question card (#182): the reply box's fill and line (`--side`, `--input-line`), no shadow, a red glyph.
test("permission, question and pick-any use the one card: fill, line, glyph, check boxes and keys line", async () => {
  test.setTimeout(90_000);
  for (const [name, region, keys] of [["bash-permission", "Approval", "1-2 pick  ⏎ send"], ["question", "Question", "1-2 pick  ⏎ send"], ["multi-question", "Question", "1-3 toggle  ⏎ next"]] as const) {
    // The fake hc lists its agents, so the head can name the shown agent.
    const { app, page } = await open(name, { FAKE_HC_AGENTS: "1" });
    const section = page.getByRole("region", { name: region });
    await expect(section).toBeVisible();
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const look = await section.evaluate((el) => {
        const probe = document.createElement("div");
        probe.style.cssText = "background: var(--side); border: 1px solid var(--input-line); color: var(--blocked)";
        document.body.append(probe);
        const want = getComputedStyle(probe);
        const got = getComputedStyle(el);
        const glyph = getComputedStyle(el.querySelector('[data-state="blocked"]')!);
        const r = { bg: [got.backgroundColor, want.backgroundColor], line: [got.borderTopColor, want.borderTopColor], glyph: [glyph.color, want.color], shadow: got.boxShadow };
        probe.remove();
        return r;
      });
      expect(look.bg[0]).toBe(look.bg[1]);
      expect(look.line[0]).toBe(look.line[1]);
      expect(look.glyph[0]).toBe(look.glyph[1]);
      expect(look.shadow).toBe("none");
    }
    await expect(section.getByRole("img", { name: "Needs you" })).toHaveCount(1);
    await expect(section).toContainText(keys);
    // The head (chat-screen.html `.qh`): the shown agent's title and the card's age come before what the source says.
    await expect(page.getByRole("navigation", { name: "Projects" })).toContainText("Chat panel usability audit");
    await expect(section.locator("p").first()).toHaveText(/^orch-contr-desktopChat panel usability audit · <1m · /);
    if (name === "question") {
      // One choice: the detail is a 12/17 px line under the label (`.opt .d`).
      const detail = section.getByText("Lost when the window closes");
      await expect(detail).toHaveCSS("font-size", "12px");
      await expect(detail).toHaveCSS("line-height", "17px");
      await expect(detail).not.toHaveCSS("font-family", /mono/i);
    }
    if (name === "multi-question") {
      // Pick-any shows check boxes, not key numbers; the keys still toggle.
      await expect(section.getByRole("checkbox", { name: "Typecheck", exact: true })).toHaveText("Typechecktsc --noEmit");
      await key(page, "2");
      await expect(section.getByRole("checkbox", { name: "Lint", exact: true })).toBeChecked();
      await expect(section.getByRole("checkbox", { name: "Lint", exact: true }).locator("svg")).toHaveCount(1);
    }
    if (region === "Question") await expect(section.getByRole("textbox", { name: "Own answer" })).toHaveAttribute("placeholder", "Or type an answer");
    await app.close();
  }
});
