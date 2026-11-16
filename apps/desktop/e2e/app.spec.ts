import { _electron as electron, expect, test } from "@playwright/test";
import path from "node:path";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");

test("the window opens on the dark canvas", async () => {
  const app = await electron.launch({ args: ["."], cwd: path.resolve(import.meta.dirname, "..") });
  const page = await app.firstWindow();
  await page.waitForSelector("main");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
  expect(bg).toBe("rgb(32, 32, 32)");
  await page.screenshot({ path: path.join(shots, "empty-window.png") });
  await app.close();
});
