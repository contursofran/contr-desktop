import { expect, test, type ElectronApplication } from "@playwright/test";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

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

test("Inbox writes reach the orchestration tool and update the native badge", async () => {
  test.setTimeout(60_000);
  const { app, page, runs } = await open();
  const row = page.getByRole("button", { name: /^Inbox/ });
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 5", 5]);
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });

  await list.locator('[data-item="D8"]').getByRole("button").click();
  await list.locator('[data-item="D8"]').getByRole("radio", { name: "No", exact: true }).click();
  await expect(list.locator('[data-item="D8"]')).toHaveCount(0);
  await list.locator('[data-item="D9"]').getByRole("button").click();
  await list.locator('[data-item="D9"]').getByRole("radio", { name: "Ok", exact: true }).click();
  await expect(list.locator('[data-item="D9"]')).toHaveCount(0);
  await list.locator('[data-item="T3"]').getByRole("button", { name: "Done" }).click();
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 2", 2]);
  expect(runs()).toEqual(["answer D8 No", "answer D9 Ok", "done T3"]);
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
  await expect.poll(() => count(app)).toEqual(["contr · Inbox 2", 2]);
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });

  await list.locator('[data-item="t11"]').getByRole("button").click();
  const card = page.getByRole("region", { name: "Question" });
  await card.getByRole("radio", { name: "localStorage", exact: true }).click();
  await expect(card).toContainText("Answer sent. Waiting for the agent.");
  expect(JSON.parse(readFileSync(log, "utf8").trim())).toMatchObject({ cmd: "answer", terminal: "t11", answers: [{ picks: [1] }] });

  // hc says the agent goes on: the item closes.
  writeFileSync(status, JSON.stringify({ t11: "working" }));
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
  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await list.locator('[data-item="t9"]').getByRole("button").click();
  await expect(page.getByRole("textbox", { name: "Reply to Cards for prompts and questions" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Approval" })).toBeVisible();
  await app.close();
});
