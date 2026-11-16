import { expect, test } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

function launch(env: Record<string, string>) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    ...env,
  });
}

test("with no workers, Orchestrate puts /contr:orchestrate in the reply box and does not send", async () => {
  test.setTimeout(60_000);
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch({ FAKE_ORCH_NONE: "1", FAKE_HELPER_SEND_LOG: log });
  const page = await app.firstWindow();
  const status = page.getByLabel("Status");
  const orchestrate = status.getByRole("button", { name: "Orchestrate" });
  await expect(orchestrate).toBeVisible();
  await expect(status).not.toContainText("Orchestrating");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `orchestrate-${scheme}.png`) });
  }

  await orchestrate.click();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  await expect(box).toHaveValue("/contr:orchestrate ");
  await expect(box).toBeFocused();
  const caret = await box.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]);
  expect(caret).toEqual([19, 19]);
  expect(existsSync(log) ? readFileSync(log, "utf8") : "").toBe("");
  await app.close();
});

test("with workers, the status line says Orchestrating and has no Orchestrate", async () => {
  test.setTimeout(60_000);
  const app = await launch({});
  const page = await app.firstWindow();
  const status = page.getByLabel("Status");
  await expect(status).toContainText("Orchestrating · 3 workers");
  await expect(status.getByRole("button", { name: "Orchestrate" })).toHaveCount(0);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `orchestrating-${scheme}.png`) });
  }
  await app.close();
});
