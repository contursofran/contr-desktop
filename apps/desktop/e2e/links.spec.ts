import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("a link in a message opens the browser, never a window or a navigation of the app", async () => {
  test.setTimeout(60_000);
  const openLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "open.txt");
  const opened = () => { try { return readFileSync(openLog, "utf8"); } catch { return ""; } };
  const app = await launchApp({
    CONTR_TERMINAL: "t1",
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/links-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    CONTR_OPEN_LOG: openLog,
  });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const row = await chatRow(page, "a1");
  const appUrl = page.url();
  const windows = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  // Clicks through Playwright on the element: no OS mouse.
  await row.getByRole("link", { name: "Electron docs" }).click();
  await expect.poll(opened).toBe("https://www.electronjs.org/docs/latest\n");
  // A local path, a custom scheme and a script open nothing. The Markdown step drops the last two hrefs.
  for (const name of ["local file", "absolute path", "custom scheme", "script"]) await row.locator("a", { hasText: name }).click();
  await page.waitForTimeout(500);
  expect(opened()).toBe("https://www.electronjs.org/docs/latest\n");
  expect(await windows()).toBe(1);
  await row.screenshot({ path: path.join(shots, "links-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await row.screenshot({ path: path.join(shots, "links-light.png") });
  // The page itself cannot navigate away, and window.open gives no window. A stopped navigation makes Playwright's
  // locators wait for it, so the checks from here on run in the page.
  await page.evaluate(() => { window.open("file:///etc/hosts"); location.href = "file:///etc/hosts"; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.href = "contr-e2e-nothing://plan.md"; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.href = "https://example.com/nav"; });
  await expect.poll(opened).toBe("https://www.electronjs.org/docs/latest\nhttps://example.com/nav\n");
  expect(await windows()).toBe(1);
  expect(await page.evaluate(() => [location.href, document.querySelectorAll("[data-row-id=a1] a").length])).toEqual([appUrl, 5]);
  await app.close();
});
