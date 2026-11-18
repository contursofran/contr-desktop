import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

/** The computed color of a theme token, as the browser writes it. */
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${n})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

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
  // A label column and the text, with no bar. Only "Decision needed" is red: it waits for the owner.
  const [dim, red, hairline, ink100] = [await token(page, "color-dim"), await token(page, "blocked"), await token(page, "hairline"), await token(page, "ink-100")];
  expect(await remarks.locator(".chat-remark-word").evaluateAll((els) => els.map((e) => getComputedStyle(e).color)))
    .toEqual([dim, red, dim, dim, dim]);
  for (const remark of await remarks.all()) {
    expect(await remark.evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe("0px");
    const label = (await remark.locator(".chat-remark-word").boundingBox())!;
    const said = (await remark.locator("p").nth(1).boundingBox())!;
    expect(said.x).toBeGreaterThanOrEqual(label.x + 110);
  }

  const images = row.locator("img");
  await expect(images).toHaveCount(2);
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(images.first()).toHaveAttribute("alt", "The login form");
  // Images have a hairline frame; links are in the brightest ink.
  expect(await images.first().evaluate((e) => [getComputedStyle(e).borderTopWidth, getComputedStyle(e).borderTopColor])).toEqual(["1px", hairline]);
  expect(await row.getByRole("link", { name: "Not an image" }).evaluate((e) => getComputedStyle(e).color)).toBe(ink100);
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
