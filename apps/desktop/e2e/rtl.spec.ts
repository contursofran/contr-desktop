import { expect, test, type Locator } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

const direction = (el: Locator) => el.evaluate((e) => getComputedStyle(e).direction);
const box = async (el: Locator) => (await el.boundingBox())!;

test("right-to-left text has a right-to-left base; code and English stay left to right", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/rtl-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 800));

  // The owner's bubble: Arabic first is right to left, English first is left to right.
  expect(await direction((await chatRow(page, "u1")).locator("p"))).toBe("rtl");
  expect(await direction((await chatRow(page, "u2")).locator("p"))).toBe("ltr");

  const md = (await chatRow(page, "a1")).locator(".chat-markdown");
  const p = md.locator(":scope > p");
  expect(await direction(md.locator("h2"))).toBe("rtl");
  // A Hebrew paragraph starts at the right: its text ends at the right edge of the paragraph.
  expect(await direction(p.nth(0))).toBe("rtl");
  const text = await p.nth(0).evaluate((e) => {
    const r = document.createRange();
    r.selectNodeContents(e);
    return r.getBoundingClientRect().right - e.getBoundingClientRect().right;
  });
  expect(Math.abs(text)).toBeLessThan(2);
  // Arabic with code and bold: the line is right to left, the code in it left to right.
  expect(await direction(p.nth(1))).toBe("rtl");
  expect(await direction(p.nth(1).locator("code"))).toBe("ltr");
  expect(await p.nth(1).locator("strong").textContent()).toBe("راجع النتيجة");
  // Mixed lines take the direction of their first letter.
  expect(await direction(p.nth(2))).toBe("ltr");
  expect(await direction(p.nth(3))).toBe("rtl");

  // Each list item has its own direction; the indent and the marker are on its start side.
  const ul = await box(md.locator("ul"));
  const [he, en] = [md.locator("li").nth(0), md.locator("li").nth(1)];
  expect(await direction(he)).toBe("rtl");
  expect(await direction(en)).toBe("ltr");
  expect(Math.round(ul.x + ul.width - ((await box(he)).x + (await box(he)).width))).toBe(20);
  expect(Math.round((await box(en)).x - ul.x)).toBe(20);

  // A Hebrew quote has its bar at the right.
  const quote = md.locator("blockquote:not(.chat-remark)");
  expect(await direction(quote)).toBe("rtl");
  expect(await quote.evaluate((e) => [getComputedStyle(e).borderRightWidth, getComputedStyle(e).borderLeftWidth])).toEqual(["2px", "0px"]);
  // A Hebrew remark is right to left too: its bar and its English word are at the right.
  const remark = md.locator(".chat-remark");
  expect(await direction(remark)).toBe("rtl");
  expect(await remark.evaluate((e) => getComputedStyle(e).borderRightWidth)).toBe("3px");

  expect(await direction(md.locator("th").first())).toBe("rtl");
  expect(await direction(md.locator("td").first())).toBe("rtl");
  expect(await direction(md.locator(".chat-markdown-codeblock"))).toBe("ltr");

  // A pure English answer is unchanged: left to right, the indent and the bar at the left.
  const plain = (await chatRow(page, "a2")).locator(".chat-markdown");
  for (const el of await plain.locator("p, li, blockquote").all()) expect(await direction(el)).toBe("ltr");
  const plainUl = await box(plain.locator("ul"));
  expect(Math.round((await box(plain.locator("li").first())).x - plainUl.x)).toBe(20);
  expect(await plain.locator("blockquote").evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe("2px");

  await (await chatRow(page, "a1")).evaluate((e) => e.scrollIntoView({ block: "center" }));
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `rtl-${scheme}.png`) });
  }
  await app.close();
});
