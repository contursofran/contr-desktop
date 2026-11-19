import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

test("the local image protocol serves the remark fixtures and refuses a file that is not an image", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/remarks-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");
  const images = row.locator('img[src^="contr-image://local/"]');
  await expect(images).toHaveCount(2);
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  }
  // The protocol refuses a file that is not an image.
  const refused = await page.evaluate(async (p) => (await fetch(`contr-image://local${p}`).catch(() => null))?.status ?? "error",
    path.join(e2e, "fixtures/remarks-session.jsonl"));
  expect(refused).not.toBe(200);
  await app.close();
});
