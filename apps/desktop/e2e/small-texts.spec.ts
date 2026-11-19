import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

const base = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

test("main returns Terminal for an hc terminal with no known title", async () => {
  test.setTimeout(60_000);
  // G11: t1 is not in the sidebar; hc gives it no title and no agent.
  const app = await launchApp({ ...base, FAKE_HC_AGENTS: "0", CONTR_TERMINAL: "t1" });
  const page = await app.firstWindow();
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Terminal");
  await app.close();
});

test("the helper error copies the configured helper path to the native clipboard", async () => {
  test.setTimeout(60_000);
  const flag = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-flag-")), "down");
  writeFileSync(flag, "");
  const app = await launchApp({ ...base, FAKE_HELPER_ERROR_WHILE: flag });
  const page = await app.firstWindow();

  // G13: the error block.
  const alert = page.getByRole("alert", { name: "Helper error" });
  await app.evaluate(({ clipboard }) => clipboard.clear());
  await alert.getByRole("button", { name: "Copy path" }).click();
  await expect(alert.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(base.CONTR_HELPER);

  await app.close();
});
