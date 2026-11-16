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
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("the Inbox row opens every open item, oldest first; an answer here closes it everywhere", async () => {
  test.setTimeout(60_000);
  const { app, page, runs } = await open();
  const row = page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /^Inbox/ });
  await expect(row).toHaveText("Inbox · 5");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 5", 5]);
  await expect(page.getByRole("navigation", { name: "Projects" })).toContainText("Install health check");
  await shoot(page, "inbox-row");

  await row.click();
  await expect(row).toHaveAttribute("aria-current", "true");
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveText([
    /^Chat panel usability auditD7 · The coordinator asks/,
    /^Chat panel usability auditD8 · The coordinator asks/,
    /^Install health checkD9 · The coordinator asks/,
    /^Chat panel usability auditT3 · To do/,
    /^Chat panel usability auditT4 · To know/,
  ]);
  await expect(list).not.toContainText("more after this");
  await shoot(page, "inbox-list");

  // Digit keys do not answer in the Inbox: many cards show at once.
  await page.keyboard.press("1");
  await list.locator('[data-item="D9"]').getByRole("button", { name: /Ok/ }).click();
  await list.locator('[data-item="T3"]').getByRole("button", { name: "Done" }).click();
  await expect(list.locator("[data-item]")).toHaveCount(3);
  await expect(row).toHaveText("Inbox · 3");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 3", 3]);
  expect(runs()).toEqual([expect.stringMatching(/^answer D9 Ok$/), "done T3"]);

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
  await expect(row).toHaveText("Inbox · 2");
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 2", 2]);
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveText([/^(blocked)?Release notes draftWaits on a prompt$/, /^Install health checkD9 · The coordinator asks/]);
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
  await expect(row).toHaveText("Inbox · 1", { timeout: 20_000 });
  await expect.poll(() => count(app), { timeout: 20_000 }).toEqual(["contr · Inbox 1", 1]);
  await app.close();
});
