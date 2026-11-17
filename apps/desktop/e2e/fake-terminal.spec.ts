import { expect, test } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatList } from "./chat";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

// The fake hc has no `connect`: the attach fails. The test checks which hc the Terminal side runs, not its bytes
// (terminal.spec.ts does that with a scratch hc core).
test("the Terminal side connects through the hc that CONTR_HC names, never the hc on PATH", async () => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const log = path.join(dir, "hc.log");
  const pathLog = path.join(dir, "path-hc.log");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fixtures/hc-log/hc"),
    CONTR_HC_SESSION: "cde-none",
    FAKE_HC_AGENTS: "1",
    FAKE_HC_LOG: log,
    // A first `hc` on PATH that fails: a call that ignores CONTR_HC never reaches the owner's hc core.
    PATH: `${path.join(e2e, "fixtures/path-hc")}${path.delimiter}${process.env.PATH}`,
    PATH_HC_LOG: pathLog,
  });
  const page = await app.firstWindow();
  await expect(chatList(page).locator('[data-row-id="a6"]')).toBeVisible();
  const sw = page.getByRole("group", { name: "Chat or Terminal" });
  await sw.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByTestId("terminal")).toBeVisible();
  await expect.poll(() => (existsSync(log) ? readFileSync(log, "utf8").split("\n") : [])).toContain("connect --session cde-none");
  expect(existsSync(pathLog) ? readFileSync(pathLog, "utf8") : "").toBe("");

  await sw.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByTestId("terminal")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  await app.close();
});
