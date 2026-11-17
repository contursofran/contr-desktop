import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

function launch(sendLog: string, env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: sendLog,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    FAKE_HC_CWD: os.tmpdir(),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    FAKE_GIT_BRANCH: "agent/11-reply-menu",
    ...env,
  });
}

const sent = (log: string) => !existsSync(log) ? [] : readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l).text as string);

test("the reply box shows the model, effort, context and branch, and the menu sends /model and /effort", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(log);
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const model = page.getByRole("button", { name: "Model" });
  await expect(model).toHaveText("Opus 5.5medium");
  await expect(page.getByLabel("Context 37%")).toHaveText("37%");
  await expect(page.getByLabel("Branch")).toHaveText("agent/11-reply-menu");
  await page.getByRole("form", { name: "Reply" }).screenshot({ path: path.join(shots, "reply-foot-dark.png") });

  await model.click();
  const menu = page.getByRole("menu", { name: "Model" });
  await expect(menu.getByRole("menuitemradio")).toHaveText(["Opus 5.5", "Sonnet 5", "low", "medium", "high"]);
  await expect(menu.getByRole("menuitemradio", { checked: true })).toHaveText(["Opus 5.5", "medium"]);
  await page.screenshot({ path: path.join(shots, "reply-menu-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "reply-menu-light.png") });

  await menu.getByRole("menuitemradio", { name: "Sonnet 5" }).click();
  // The choice shows at once, before the helper agrees (herdr-contr #208).
  await expect(model).toHaveText("Sonnet 5medium");
  await expect.poll(() => sent(log)).toEqual(["/model claude-sonnet-5"]);
  await model.click();
  await menu.getByRole("menuitemradio", { name: "high" }).click();
  await expect(model).toHaveText("Sonnet 5high");
  await expect.poll(() => sent(log)).toEqual(["/model claude-sonnet-5", "/effort high"]);
  await app.close();
});

test("the menu opens before the first reply, when the helper knows no model (herdr-contr #209)", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(log, { FAKE_HELPER_MODEL: "none" });
  const page = await app.firstWindow();
  const model = page.getByRole("button", { name: "Model" });
  await expect(model).toHaveAttribute("aria-haspopup", "menu");
  await expect(model).toHaveText("Model");
  await model.click();
  await page.getByRole("menuitemradio", { name: "Opus 5.5" }).click();
  await expect.poll(() => sent(log)).toEqual(["/model claude-opus-5-5"]);
  await app.close();
});

test("the menu moves with the keys, picks with Enter, and closes on Escape and outside clicks with focus back on the button", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(log);
  const page = await app.firstWindow();
  const model = page.getByRole("button", { name: "Model" });
  const menu = page.getByRole("menu", { name: "Model" });
  await expect(model).toHaveText("Opus 5.5medium");

  // Escape closes it and gives focus back to the button.
  await model.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(model).toBeFocused();

  // A click outside closes it.
  await model.click();
  await expect(menu).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(menu).toBeHidden();

  // Arrow keys move, typeahead jumps, Enter picks and closes.
  await model.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(menu.locator("[data-highlighted]")).toHaveText("Sonnet 5");
  await page.keyboard.type("h");
  await expect(menu.locator("[data-highlighted]")).toHaveText("high");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(model).toBeFocused();
  await expect(model).toHaveText("Opus 5.5high");
  await expect.poll(() => sent(log)).toEqual(["/effort high"]);
  await app.close();
});

// The app with the fake agents in the sidebar, each with its own title (no FAKE_HC_TITLE), and three workers under t7.
function launchAgents(sendLog: string, env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: sendLog,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    ...env,
  });
}

const row = (page: Page, name: RegExp) => page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name }).first();
const replyBox = (page: Page) => page.getByRole("textbox", { name: /^Reply to/ });

test("a draft stays for each agent over a switch to another agent, the Inbox and Settings, and a send clears it", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchAgents(log);
  const page = await app.firstWindow();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Chat panel usability audit");
  await replyBox(page).fill("a draft for the audit");

  await row(page, /Release notes draft/).click();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Release notes draft");
  await expect(replyBox(page)).toHaveValue("");
  await replyBox(page).fill("a draft for the notes");

  await page.getByRole("button", { name: /^Inbox/ }).click();
  await expect(replyBox(page)).toHaveCount(0);
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  await row(page, /Chat panel usability audit/).click();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Chat panel usability audit");
  await expect(replyBox(page)).toHaveValue("a draft for the audit");
  await row(page, /Release notes draft/).click();
  await expect(replyBox(page)).toHaveValue("a draft for the notes");

  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => sent(log)).toEqual(["a draft for the notes"]);
  await expect(replyBox(page)).toHaveValue("");
  await row(page, /Chat panel usability audit/).click();
  await expect(replyBox(page)).toHaveValue("a draft for the audit");
  await row(page, /Release notes draft/).click();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Release notes draft");
  await expect(replyBox(page)).toHaveValue("");
  await app.close();
});

test("a message that is not sent stays in the box over a switch to another agent", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchAgents(log, { FAKE_HELPER_SEND_ERROR: "no_terminal" });
  const page = await app.firstWindow();
  await replyBox(page).fill("this send fails");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("form", { name: "Reply" }).getByRole("alert")).toContainText("Not sent");
  await row(page, /Release notes draft/).click();
  await expect(replyBox(page)).toHaveAccessibleName("Reply to Release notes draft");
  await row(page, /Chat panel usability audit/).click();
  await expect(replyBox(page)).toHaveValue("this send fails");
  await app.close();
});

test("the box grows with its text up to 40% of the window, then scrolls, and shrinks after a send", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(log);
  const page = await app.firstWindow();
  const box = replyBox(page);
  const size = () => box.evaluate((el) => ({ height: el.clientHeight, scroll: el.scrollHeight, limit: Math.floor(window.innerHeight * 0.4) }));
  await expect(box).toBeVisible();
  const empty = (await size()).height;

  await box.fill(["one", "two", "three", "four", "five"].join("\n"));
  await expect.poll(async () => (await size()).height).toBeGreaterThan(empty);
  const five = await size();
  expect(five.scroll).toBe(five.height);

  await box.fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"));
  await expect.poll(async () => (await size()).height).toBe(five.limit);
  const full = await size();
  expect(full.scroll).toBeGreaterThan(full.height);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `reply-grown-${scheme}.png`) });
  }

  await page.getByRole("button", { name: "Send" }).click();
  await expect(box).toHaveValue("");
  await expect.poll(async () => (await size()).height).toBe(empty);
  await app.close();
});

test("in a 900x600 window the status line and the reply box keep 16 px of side space, as the chat rows do", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchAgents(log);
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(900, 600));
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(900);
  const status = page.getByLabel("Status");
  await expect(status).toContainText("Orchestrating · 3 workers");
  const main = (await page.locator("main").boundingBox())!;
  for (const part of [status, page.getByRole("form", { name: "Reply" })]) {
    const b = (await part.boundingBox())!;
    expect(b.x - main.x).toBeGreaterThanOrEqual(16);
    expect(main.x + main.width - (b.x + b.width)).toBeGreaterThanOrEqual(16);
  }
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `reply-narrow-${scheme}.png`) });
  }
  await app.close();
});

test("in a narrow window the status line cuts its working text with an ellipsis and keeps the orchestrator text", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchAgents(log);
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(640, 600));
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(640);
  const status = page.getByLabel("Status");
  await expect(status).toContainText("Hashing…");
  const right = status.getByText("Orchestrating · 3 workers");
  // The orchestrator text shows in full, inside the status line.
  await expect.poll(() => right.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const line = (await status.boundingBox())!;
  const r = (await right.boundingBox())!;
  expect(r.x + r.width).toBeLessThanOrEqual(line.x + line.width);
  // The working detail is cut with an ellipsis, not past the line's edge.
  const detail = status.getByText(/tokens/);
  expect(await detail.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  expect(await detail.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await status.screenshot({ path: path.join(shots, `status-narrow-${scheme}.png`) });
  }
  await app.close();
});
