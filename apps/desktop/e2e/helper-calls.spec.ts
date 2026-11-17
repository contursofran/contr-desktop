import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");

function launch(callLog: string) {
  return launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_CALL_LOG: callLog,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HC_CONNECT: "1",
  });
}

/** The helper calls so far, as their first word (`feed`, `working`, `card`, ...). */
const calls = (log: string) => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => (JSON.parse(l) as string[])[0]) : []);
const feedCalls = (log: string) => calls(log).filter((c) => c === "feed" || c === "working" || c === "card").length;

const destroyedListeners = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.listenerCount("destroyed"));

async function open(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).first().click();
  await expect(page.getByRole("tablist", { name: "Tabs" }).getByRole("tab", { name: title })).toHaveAttribute("aria-selected", "true");
}

test("with each tab closed, main reads the helper no more; an agent shown again starts the feed again", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "calls.jsonl");
  const app = await launch(log);
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 900, height: 600 });
  await open(page, "Release notes draft");
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  for (const title of ["Release notes draft", "Chat panel usability audit"]) await page.getByRole("button", { name: `Close ${title}` }).click();
  await expect(tabs.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /^Reply to/ })).toHaveCount(0);
  // A call that started before the close can still end: wait one tick, then count.
  await page.waitForTimeout(1500);
  const before = feedCalls(log);
  await page.waitForTimeout(3000);
  expect(feedCalls(log)).toBe(before);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `helper-calls-no-agent-${scheme}.png`) });
  }
  await open(page, "Install health check");
  await expect.poll(() => feedCalls(log)).toBeGreaterThan(before);
  await app.close();
});

test("agent switches add no `destroyed` listener to the window", async () => {
  test.setTimeout(90_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "calls.jsonl");
  const app = await launch(log);
  const page = await app.firstWindow();
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("fake terminal t7 attached")).toBeVisible();
  const start = await destroyedListeners(app);
  const titles = ["Release notes draft", "Install health check", "Chat panel usability audit"];
  // 12 switches on the Terminal side (an attach each), then 12 on the Chat side (a feed each).
  for (const side of ["Terminal", "Chat"]) {
    await page.getByRole("button", { name: side, exact: true }).click();
    for (let i = 0; i < 12; i++) await open(page, titles[i % 3]);
  }
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  expect(await destroyedListeners(app)).toBe(start);
  await app.close();
});
