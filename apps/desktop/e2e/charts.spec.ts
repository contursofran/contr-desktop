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
  const row = await chatRow(page, "r1");

  // Bars: largest first, the value and the note as text, the largest bar full width.
  const bars = row.getByRole("list", { name: "Bar chart" }).locator("> li");
  await expect(bars).toHaveText([/^b-31412k · ctx 72%$/, /^b-60318k · ended$/, /^b-41230k · ctx 41%$/, /^r-3161k · ctx 12%$/]);
  const widths = await row.getByTestId("bar").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.width));
  expect(widths.map((w) => Math.round(parseFloat(w)))).toEqual([100, 77, 56, 15]);

  // Line: the latest point is brightest with its value; the outlier 9.4 has a label.
  const line = row.getByRole("img", { name: "Line chart, 12 points, latest 14:52: 6.5" });
  await expect(line).toBeVisible();
  await expect(line.getByTestId("latest-label")).toHaveText("6.5");
  await expect(line.getByTestId("outlier-label")).toHaveText("9.4");
  await expect(line.locator("text")).toHaveText(["9.4", "6.5", "11:10", "14:52"]);
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
