import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

test("contr-chart draws grey bars and a line; a bad kind stays code", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/charts-session.jsonl"),
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1440, 900));
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1440);
  const row = await chatRow(page, "r1");

  // Bars: largest first, the value and the note as text, the largest bar full width.
  const bars = row.getByRole("list", { name: "Bar chart" }).locator("> li");
  await expect(bars).toHaveText([/^b-31412k · ctx 72%$/, /^b-60318k · ended$/, /^b-41230k · ctx 41%$/, /^r-3161k · ctx 12%$/]);
  const titles = row.getByTestId("chart-title");
  await expect(titles).toHaveText(["Tokens per workerthis run", "CI time on mainlast 12 runs · minutes"]);
  await expect(titles.first()).toHaveCSS("font-size", "12.5px");
  await expect(titles.first().locator("span")).toHaveCSS("font-size", "11px");
  const values = await bars.locator("> span:last-child").evaluateAll((els) => els.map((el) => {
    const { width, top } = el.getBoundingClientRect();
    return { width, top, align: getComputedStyle(el).textAlign };
  }));
  expect(values.map((value) => value.top - values[0]!.top)).toEqual([0, 20, 40, 60]);
  expect(values.map(({ width, align }) => [width, align])).toEqual(Array.from({ length: 4 }, () => [120, "right"]));
  const widths = await row.getByTestId("bar").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.width));
  expect(widths.map((w) => Math.round(parseFloat(w)))).toEqual([100, 77, 56, 15]);

  // Line: the latest point is brightest with its value; the outlier 9.4 has a label.
  const line = row.getByRole("img", { name: "Line chart, 12 points, latest 14:52: 6.5" });
  await expect(line).toBeVisible();
  await expect(line.getByTestId("latest-label")).toHaveText("6.5");
  await expect(line.getByTestId("outlier-label")).toHaveText("9.4 · #31");
  await expect(line.locator("text")).toHaveText(["9.4 · #31", "6.5", "11:10", "14:52"]);
  // The line stops scaling when the reading column is wider than its viewBox.
  expect((await line.boundingBox())!.width).toBe(666);
  expect((await bars.first().locator("..").boundingBox())!.width).toBeGreaterThan(666);
  const fill = (id: string) => line.getByTestId(id).evaluate((e) => getComputedStyle(e).fill);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await fill("latest")).toBe("rgb(244, 244, 245)");
  expect(await fill("outlier")).toBe("rgba(255, 255, 255, 0.6)");

  // The block with an unknown kind shows as code.
  await expect(row.locator("pre")).toHaveCount(1);
  await expect(row.locator("pre")).toContainText("b-31 | 412k | ctx 72%");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    if (scheme === "light") expect(await fill("outlier")).toBe("rgba(0, 0, 0, 0.667)"); // --ink-60 0.665, rounded to 8 bits
    await page.screenshot({ path: path.join(shots, `charts-${scheme}.png`), fullPage: true });
  }
  await app.close();
});
