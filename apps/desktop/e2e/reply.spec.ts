import { expect, test } from "@playwright/test";
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
  const menu = page.getByRole("menu", { name: "Model and effort" });
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
