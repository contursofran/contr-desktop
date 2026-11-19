import { expect, test } from "vitest";
import transcript from "../../e2e/fixtures/rtl-session.jsonl?raw";
import { chatRow, shoot } from "../../test/274-chat";
import { renderApp } from "../../test/renderApp";

const direction = (el: Element) => getComputedStyle(el).direction;
const box = (el: Element) => el.getBoundingClientRect();

test("right-to-left text has a right-to-left base; code and English stay left to right", async () => {
  await renderApp(transcript);

  // The owner's bubble uses the direction of its first letter.
  expect(direction((await chatRow("u1")).querySelector("p")!)).toBe("rtl");
  expect(direction((await chatRow("u2")).querySelector("p")!)).toBe("ltr");

  const md = (await chatRow("a1")).querySelector(".chat-markdown")!;
  const [hebrew, arabic, mixedEnglish, mixedHebrew] = Array.from(md.querySelectorAll(":scope > p"));
  expect(direction(md.querySelector("h2")!)).toBe("rtl");
  // A Hebrew paragraph starts at the right: its text ends at the right edge of the paragraph.
  expect(direction(hebrew)).toBe("rtl");
  const range = document.createRange();
  range.selectNodeContents(hebrew);
  expect(Math.abs(range.getBoundingClientRect().right - box(hebrew).right)).toBeLessThan(2);
  // The Arabic line is right to left and its inline code is left to right.
  expect(direction(arabic)).toBe("rtl");
  expect(direction(arabic.querySelector("code")!)).toBe("ltr");
  expect(arabic.querySelector("strong")!.textContent).toBe("راجع النتيجة");
  expect(direction(mixedEnglish)).toBe("ltr");
  expect(direction(mixedHebrew)).toBe("rtl");

  // Each list item has its own direction, with the indent and marker on its start side.
  const ul = box(md.querySelector("ul")!);
  const [he, en] = Array.from(md.querySelectorAll("li"));
  expect(direction(he)).toBe("rtl");
  expect(direction(en)).toBe("ltr");
  expect(Math.round(ul.right - box(he).right)).toBe(20);
  expect(Math.round(box(en).x - ul.x)).toBe(20);

  const quote = md.querySelector("blockquote:not(.chat-remark)")!;
  expect(direction(quote)).toBe("rtl");
  const quoteStyle = getComputedStyle(quote);
  expect([quoteStyle.borderRightWidth, quoteStyle.borderLeftWidth]).toEqual(["2px", "0px"]);
  // The English label is at the right of the Hebrew remark.
  const remark = md.querySelector(".chat-remark")!;
  expect(direction(remark)).toBe("rtl");
  const label = box(remark.querySelector(".chat-remark-word")!);
  const said = box(remark.querySelector(":scope > :not(.chat-remark-word)")!);
  expect(label.x).toBeGreaterThan(said.right);

  expect(direction(md.querySelector("th")!)).toBe("rtl");
  expect(direction(md.querySelector("td")!)).toBe("rtl");
  expect(direction(md.querySelector(".chat-markdown-codeblock")!)).toBe("ltr");

  // An English answer is left to right, with the indent and bar on the left.
  const plain = (await chatRow("a2")).querySelector(".chat-markdown")!;
  plain.querySelectorAll("p, li, blockquote").forEach((el) => expect(direction(el)).toBe("ltr"));
  const plainUl = box(plain.querySelector("ul")!);
  expect(Math.round(box(plain.querySelector("li")!).x - plainUl.x)).toBe(20);
  expect(getComputedStyle(plain.querySelector("blockquote")!).borderLeftWidth).toBe("2px");

  (await chatRow("a1")).scrollIntoView({ block: "center" });
  await shoot("rtl");
}, 60_000);
