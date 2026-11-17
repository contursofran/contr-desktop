import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

/** The computed value of a theme token, as the browser writes it. */
const token = (page: Page, name: string, prop: "color" | "backgroundColor") =>
  page.evaluate(
    ([n, p]) => {
      const probe = document.createElement("span");
      probe.style[p] = `var(--color-${n})`;
      document.body.append(probe);
      const value = getComputedStyle(probe)[p];
      probe.remove();
      return value;
    },
    [name, prop] as const,
  );

test("a picture that cannot load is a muted chip with an icon; a web picture stays a link", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/missing-picture-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const md = (await chatRow(page, "a1")).locator(".chat-markdown");

  // Not there, no alt text, and a type the protocol does not serve: each a chip, with the path as tooltip.
  const chips = md.locator("[data-missing-image]");
  await expect(chips).toHaveText(["build graph", "/nonexistent/no-alt.png", "The spinner"]);
  expect(await chips.evaluateAll((all) => all.map((e) => e.getAttribute("title")))).toEqual([
    "/nonexistent/graph.png", "/nonexistent/no-alt.png", "/nonexistent/spin.gif",
  ]);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const chip of await chips.all()) {
      await expect(chip.locator("svg")).toHaveCount(1);
      const style = await chip.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
      expect(style).toEqual([await token(page, "muted", "color"), await token(page, "selected", "backgroundColor")]);
    }
  }

  // The picture that loads draws; the web picture is a link, not a picture.
  const images = md.locator("img");
  await expect(images).toHaveCount(1);
  await expect(images).toHaveAttribute("alt", "The login form");
  await expect(md.locator('a[href="https://example.com/web.png"]')).toHaveText("A web image");

  await md.evaluate((e) => e.scrollIntoView({ block: "start" }));
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `missing-picture-${scheme}.png`) });
  }
  await app.close();
});
