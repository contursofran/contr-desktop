import { expect, test, type ElectronApplication } from "@playwright/test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

/** The window title and the badge value as the main process set them (e2e sets no Dock badge). */
const count = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => [BrowserWindow.getAllWindows()[0]!.getTitle(), (globalThis as { contrInboxBadge?: number }).contrInboxBadge ?? -1] as const);

test("a failed orchestration read keeps the last good items and native badge through recovery", async () => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-"));
  const file = path.join(dir, "open.json");
  const bad = path.join(dir, "bad");
  copyFileSync(path.join(e2e, "fixtures/owner/open.json"), file);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    CONTR_TERMINAL: "t7",
    FAKE_ORCH_OWNER: file,
    FAKE_ORCH_OWNER_BAD: bad,
  });
  const page = await app.firstWindow();
  const row = page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /^Inbox/ });
  const note = page.getByRole("alert").filter({ hasText: "Cannot read the owner items" });

  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveCount(5);

  writeFileSync(bad, "{oops not json");
  await expect(note).toHaveText("Cannot read the owner items: herdr-contr-orch gave no JSON list", { timeout: 10_000 });
  await expect(list.locator("[data-item]")).toHaveCount(5);
  expect(await count(app)).toEqual(["contr · Inbox 5", 5]);

  rmSync(bad);
  await expect(note).toHaveCount(0, { timeout: 10_000 });
  await expect(list.locator("[data-item]")).toHaveCount(5);
  expect(await count(app)).toEqual(["contr · Inbox 5", 5]);
  await app.close();
});
