import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

test("PR and issue numbers show as chips with gh's state", async () => {
  test.setTimeout(60_000);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const ghLog = path.join(tmp, "gh.jsonl");
  const openLog = path.join(tmp, "open.txt");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    CONTR_REPO_DIR: tmp,
    FAKE_GH_LOG: ghLog,
    CONTR_OPEN_LOG: openLog,
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "a6");
  const chips = row.locator("[data-ref-state]");
  const merged = row.getByRole("link", { name: "PR #12, Merged, 6 of 6 checks passed" });
  await expect(chips).toHaveCount(9);
  // gh: one batched call, never twice for a number within a minute.
  const calls = readFileSync(ghLog, "utf8").trim().split("\n").map((l) => JSON.parse(l) as number[]);
  expect(calls.flat().sort((a, b) => a - b)).toEqual([...new Set(calls.flat())].sort((a, b) => a - b));
  expect(calls.flat()).toEqual(expect.arrayContaining([9, 12, 14, 15, 20, 21, 22, 99]));
  // The main process opens the PR URL; the launcher logs it in e2e.
  await merged.click();
  await expect.poll(() => { try { return readFileSync(openLog, "utf8"); } catch { return ""; } }).toBe("https://github.com/o/r/pull/12\n");
  await app.close();
});
