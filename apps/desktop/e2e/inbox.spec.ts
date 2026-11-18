import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

async function open(ids?: string[], env: Record<string, string> = {}) {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "open.json");
  copyFileSync(path.join(e2e, "fixtures/owner/open.json"), file);
  if (ids) writeFileSync(file, JSON.stringify(JSON.parse(readFileSync(file, "utf8")).filter((i: { id: string }) => ids.includes(i.id))));
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    CONTR_TERMINAL: "t7",
    FAKE_ORCH_OWNER: file,
    ...env,
  });
  const page = await app.firstWindow();
  const runs = () => readFileSync(`${file}.log`, "utf8").trim().split("\n");
  return { app, page, runs };
}

/** The window title and the badge value as the main process set them (e2e sets no Dock badge). */
const count = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => [BrowserWindow.getAllWindows()[0]!.getTitle(), (globalThis as { contrInboxBadge?: number }).contrInboxBadge ?? -1] as const);

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // A chip's label fades its color (transition-colors): wait for the color transitions, not the endless glyph motion.
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished)));
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("the Inbox row opens every open item, oldest first; an answer here closes it everywhere", async () => {
  test.setTimeout(60_000);
  // The fake gh knows #15 (a ref of D7); it runs in a scratch folder.
  const { app, page, runs } = await open(undefined, { CONTR_REPO_DIR: mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")) });
  const row = page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /^Inbox/ });
  await expect(row).toHaveText("Inbox5");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 5", 5]);
  await expect(page.getByRole("navigation", { name: "Projects" })).toContainText("Install health check");
  await shoot(page, "inbox-row");

  await row.click();
  await expect(row).toHaveAttribute("aria-current", "true");
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list).toContainText("Inbox5 open · oldest first");
  // One row per item, oldest first. The oldest is open as its card; the others are one line: id, text, kind, title, from, coordinator, end.
  await expect(list.locator("[data-item]")).toHaveText([
    /^D7Question · Inbox order · from b-15 · Chat panel usability auditWhich items show first in the inbox\?/,
    "D8Does the Dock badge count to-dos?Question · Dock badge · from b-16 · Chat panel usability audit2 answers",
    "D9Not for this chat.Question · Other · from b-30 · Install health check1 answer",
    "T3Log in to the staging server, then run pnpm e2e in apps/desktop.To do · from b-15 · Chat panel usability auditDone",
    "T4The CI cache is now keyed on the lockfile.To know · from b-16 · Chat panel usability auditDone",
  ]);
  await expect(list.getByRole("region", { name: "Owner question" })).toHaveCount(1);
  await expect(list).not.toContainText("more after this");
  // The open row is the card (screens.html screen 4, `.ibx.is-open`): one glyph, no card in it.
  const card = list.locator('[data-item="D7"]');
  await expect(card.getByRole("img", { name: "Needs you" })).toHaveCount(1);
  await expect(card.locator("section")).toHaveCount(0);
  expect(await card.evaluate((e) => { const s = getComputedStyle(e); return [s.borderRadius, s.paddingTop, s.paddingLeft, s.marginTop, s.gridTemplateColumns.split(" ")[0]]; })).toEqual(["12px", "12px", "10px", "6px", "16px"]);
  // The recommended answer is picked, so Send answer is on; #15 is a ref chip.
  await expect(card.getByRole("button", { name: /Oldest first/ })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("button", { name: "Send answer" })).toBeEnabled();
  await expect(card.locator('[data-ref-kind="pr"]')).toHaveAttribute("aria-label", /^PR #15/);
  await shoot(page, "inbox-list");

  // Arrow Down opens the next item; its card takes the digit keys.
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("region", { name: "Owner question" })).toContainText("Does the Dock badge count to-dos?");
  await expect(list.locator('[data-item="D7"]')).toHaveText(/^D7Which items show first in the inbox\?Question · Inbox order/);
  await page.keyboard.press("ArrowUp");
  await expect(list.getByRole("region", { name: "Owner question" })).toContainText("Which items show first in the inbox?");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("2");
  // Each answer starts its own orch run. Two runs at once append to the log in either order (#119),
  // so each press waits until the item before has closed.
  await expect(list.locator('[data-item="D8"]')).toHaveCount(0);
  // A press on a row opens it.
  await list.locator('[data-item="D9"]').getByRole("button").click();
  await list.locator('[data-item="D9"]').getByRole("button", { name: /Ok/ }).click();
  await expect(list.locator('[data-item="D9"]')).toHaveCount(0);
  // Done at the end of a closed to-do row marks it done.
  await list.locator('[data-item="T3"]').getByRole("button", { name: "Done" }).click();
  await expect(list.locator("[data-item]")).toHaveCount(2);
  await expect(row).toHaveText("Inbox2");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 2", 2]);
  expect(runs()).toEqual([expect.stringMatching(/^answer D8 No$/), expect.stringMatching(/^answer D9 Ok$/), "done T3"]);

  // The coordinator's chat no longer shows T3: the next to-do is T4.
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /Chat panel usability audit/ }).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Owner to-do" })).toContainText("T4 · To know");
  await app.close();
});

test("the Inbox row is quiet with no count when nothing is open", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open([]);
  const row = page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /^Inbox/ });
  await expect(row).toHaveText("Inbox");
  await expect.poll(() => count(app)).toEqual(["contr", 0]);
  await app.close();
});

test("an agent blocked on a prompt is an Inbox item; a press opens its card, and the item closes when it goes on", async () => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const status = path.join(dir, "status.json");
  const log = path.join(dir, "answers.jsonl");
  writeFileSync(status, JSON.stringify({ t11: "blocked" }));
  const { app, page } = await open(["D9"], {
    FAKE_HC_STATUS: status,
    FAKE_HELPER_CARD: path.join(e2e, "fixtures/cards/question.json"),
    FAKE_HELPER_ANSWER_LOG: log,
  });
  const row = page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /^Inbox/ });
  await expect(row).toHaveText("Inbox2");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 2", 2]);
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveText([/^D9Question · Other · from b-30 · Install health checkNot for this chat\./, "Release notes draftWaits on a promptOpen chat"]);
  await shoot(page, "inbox-blocked");

  await list.locator('[data-item="t11"]').getByRole("button").click();
  await expect(list).toHaveCount(0);
  const card = page.getByRole("region", { name: "Question" });
  await expect(card).toContainText("Where should the draft text be kept?");
  await card.getByRole("button", { name: /localStorage/ }).click();
  await expect(card).toContainText("Answer sent. Waiting for the agent.");
  expect(JSON.parse(readFileSync(log, "utf8").trim())).toMatchObject({ cmd: "answer", terminal: "t11", answers: [{ picks: [1] }] });

  // hc says the agent goes on: the item closes.
  writeFileSync(status, JSON.stringify({ t11: "working" }));
  await expect(row).toHaveText("Inbox1", { timeout: 20_000 });
  await expect.poll(() => count(app), { timeout: 20_000 }).toEqual(["contr · Inbox 1", 1]);
  await app.close();
});

test("a worker blocked on a prompt is an Inbox item under its title; a press opens the worker's chat with its card", async () => {
  test.setTimeout(60_000);
  const status = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "status.json");
  // b-40 (t9), a worker of t7, waits on a permission prompt.
  writeFileSync(status, JSON.stringify({ t9: "blocked" }));
  const { app, page } = await open([], { FAKE_HC_STATUS: status });
  const nav = page.getByRole("navigation", { name: "Projects" });
  const row = nav.getByRole("button", { name: /^Inbox/ });
  await expect(row).toHaveText("Inbox1");
  await expect(nav.getByRole("button", { name: /Cards for prompts and questions/ }).getByRole("img", { name: "Needs you" })).toBeVisible();
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveText(["Cards for prompts and questionsWaits on a promptOpen chat"]);
  await list.locator('[data-item="t9"]').getByRole("button").click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Reply to Cards for prompts and questions" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Approval" })).toBeVisible();
  await app.close();
});
