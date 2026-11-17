import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

/** The window title and the badge value as the main process set them (e2e sets no Dock badge). */
const count = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => [BrowserWindow.getAllWindows()[0]!.getTitle(), (globalThis as { contrInboxBadge?: number }).contrInboxBadge ?? -1] as const);

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("a failed read of the owner items keeps the last good list and the typed text, and the Inbox says why until a good read", async () => {
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

  // The coordinator's chat: its cards and a typed answer stay over a failed read.
  const cards = page.locator('section[aria-label^="Owner"]');
  await expect(cards).toHaveCount(2);
  await cards.getByLabel("Own answer").fill("typed in the chat");
  writeFileSync(bad, "{oops not json");
  // The poll is 3 s: wait for two reads with the bad output.
  await page.waitForTimeout(6_500);
  await expect(cards).toHaveCount(2);
  await expect(cards.getByLabel("Own answer")).toHaveValue("typed in the chat");
  await expect(row).toHaveText("Inbox · 5");
  rmSync(bad);

  await row.click();
  const list = page.getByRole("region", { name: "Inbox" });
  await expect(list.locator("[data-item]")).toHaveCount(5);
  await expect(note).toHaveCount(0);
  await list.locator('[data-item="D7"]').getByLabel("Own answer").fill("typed in the Inbox");

  // One bad read: the note shows, and the count, the title, the cards and the typed text stay.
  writeFileSync(bad, "{oops not json");
  await expect(note).toHaveText("Cannot read the owner items: herdr-contr-orch gave no JSON list", { timeout: 10_000 });
  await expect(list.locator("[data-item]")).toHaveCount(5);
  await expect(list).not.toContainText("Nothing needs you.");
  await expect(row).toHaveText("Inbox · 5");
  expect(await count(app)).toEqual(["contr · Inbox 5", 5]);
  await expect(list.locator('[data-item="D7"]').getByLabel("Own answer")).toHaveValue("typed in the Inbox");
  await shoot(page, "owner-read-failed");

  // A good read again: the note goes, and nothing else changed.
  rmSync(bad);
  await expect(note).toHaveCount(0, { timeout: 10_000 });
  await expect(list.locator("[data-item]")).toHaveCount(5);
  await expect(list.locator('[data-item="D7"]').getByLabel("Own answer")).toHaveValue("typed in the Inbox");
  expect(await count(app)).toEqual(["contr · Inbox 5", 5]);
  await app.close();
});
