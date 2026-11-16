import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("remarks show a word and local images draw", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/remarks-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");
  const remarks = row.locator(".chat-remark");
  await expect(remarks).toHaveCount(5);
  expect(await remarks.locator(".chat-remark-word").allTextContents()).toEqual([
    "Done", "Decision needed", "Warning", "Not verified", "Note",
  ]);
  await expect(remarks.nth(1)).toContainText("Keep the old flag one more release, or remove it now?");

  const images = row.locator("img");
  await expect(images).toHaveCount(2);
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(images.first()).toHaveAttribute("alt", "The login form");
  await expect(row.locator('a[href="https://example.com/web.png"]')).toHaveText("A web image");
  await expect(row.getByRole("link", { name: "Not an image" })).toHaveCount(1);
  // The protocol refuses a file that is not an image.
  const refused = await page.evaluate(async (p) => (await fetch(`contr-image://local${p}`).catch(() => null))?.status ?? "error",
    path.join(e2e, "fixtures/remarks-session.jsonl"));
  expect(refused).not.toBe(200);

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `remarks-${scheme}.png`), fullPage: true });
  }
  await app.close();
});
