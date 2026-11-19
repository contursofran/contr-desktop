import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import charts from "../../e2e/fixtures/charts-session.jsonl?raw";
import { browserShots, chatRow, normalizedText } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";

test("contr-chart draws grey bars and a line; a bad kind stays code", async () => {
  await renderApp(charts);
  await page.viewport(1440, 900);
  await expect.poll(() => window.innerWidth).toBe(1440);
  const row = await chatRow("r1");
  const chat = page.elementLocator(row);

  // Bars: largest first, the value and the note as text, the largest bar full width.
  const list = await chat.getByRole("list", { name: "Bar chart" }).findElement();
  const bars = Array.from(list.querySelectorAll(":scope > li"));
  expect(bars.map((bar) => bar.textContent)).toEqual([
    expect.stringMatching(/^b-31412k · ctx 72%$/),
    expect.stringMatching(/^b-60318k · ended$/),
    expect.stringMatching(/^b-41230k · ctx 41%$/),
    expect.stringMatching(/^r-3161k · ctx 12%$/),
  ]);
  const titles = chat.getByTestId("chart-title").elements();
  expect(titles.map(normalizedText)).toEqual(["Tokens per workerthis run", "CI time on mainlast 12 runs · minutes"]);
  expect(getComputedStyle(titles[0]!).fontSize).toBe("12.5px");
  expect(getComputedStyle(titles[0]!.querySelector("span")!).fontSize).toBe("11px");
  const values = Array.from(list.querySelectorAll(":scope > li > span:last-child"), (el) => {
    const { width, top } = el.getBoundingClientRect();
    return { width, top, align: getComputedStyle(el).textAlign };
  });
  expect(values.map((value) => value.top - values[0]!.top)).toEqual([0, 20, 40, 60]);
  expect(values.map(({ width, align }) => [width, align])).toEqual(Array.from({ length: 4 }, () => [120, "right"]));
  const widths = chat.getByTestId("bar").elements().map((el) => el.style.width);
  expect(widths.map((w) => Math.round(parseFloat(w)))).toEqual([100, 77, 56, 15]);

  // Line: the latest point is brightest with its value; the outlier 9.4 has a label.
  const line = chat.getByRole("img", { name: "Line chart, 12 points, latest 14:52: 6.5" });
  await expect.element(line).toBeVisible();
  await expect.element(line.getByTestId("latest-label")).toHaveTextContent("6.5");
  await expect.element(line.getByTestId("outlier-label")).toHaveTextContent("9.4 · #31");
  expect(Array.from(line.element().querySelectorAll("text"), normalizedText)).toEqual(["9.4 · #31", "6.5", "11:10", "14:52"]);
  // The line stops scaling when the reading column is wider than its viewBox.
  expect(line.element().getBoundingClientRect().width).toBe(666);
  expect(list.getBoundingClientRect().width).toBeGreaterThan(666);
  const fill = (id: string) => getComputedStyle(line.getByTestId(id).element()).fill;
  await commands.colorScheme("dark");
  expect(fill("latest")).toBe("rgb(244, 244, 245)");
  expect(fill("outlier")).toBe("rgba(255, 255, 255, 0.6)");

  // The block with an unknown kind shows as code.
  const code = row.querySelectorAll("pre");
  expect(code).toHaveLength(1);
  expect(normalizedText(code[0]!)).toContain("b-31 | 412k | ctx 72%");

  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await chatRow("r1");
    if (scheme === "light") expect(fill("outlier")).toBe("rgba(0, 0, 0, 0.667)"); // --ink-60 0.665, rounded to 8 bits
    await page.screenshot({ path: `${browserShots}/charts-${scheme}.png` });
  }
});
