import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

/** True when no part of the element's content goes past its own box. */
const fits = (el: Locator) => el.evaluate((e) => e.scrollWidth <= e.clientWidth + 1);

/** The computed color of a theme token, as the browser writes it. */
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

/** The words in the cells that a line break cuts in two (a word with more than one line box).
 * A break after a hyphen or a slash is a normal break, so those split the words here. */
const brokenWords = (table: Locator) =>
  table.evaluate((t) => {
    const out: string[] = [];
    const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (const m of text.matchAll(/[^\s/-]+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        if (range.getClientRects().length > 1) out.push(m[0]);
      }
    }
    return out;
  });

test("long words wrap in the bubble and the text; tables have a frame; diffs use plain ink", async () => {
  test.setTimeout(90_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/markdown-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();

  for (const [w, h] of [
    [1200, 800],
    [900, 600],
  ] as const) {
    await app.evaluate(({ BrowserWindow }, [cw, ch]) => BrowserWindow.getAllWindows()[0].setContentSize(cw, ch), [w, h]);
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(w);
    const size = w === 900 ? "-narrow" : "";

    // F5: the owner's bubble keeps a long URL and a long word inside it, and inside the window.
    const user = await chatRow(page, "u1");
    const bubble = user.locator("p");
    await expect(bubble).toContainText("https://example.com/a/very/long/url");
    expect(await fits(bubble)).toBe(true);
    expect((await bubble.boundingBox())!.x + (await bubble.boundingBox())!.width).toBeLessThanOrEqual(w);
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({ path: path.join(shots, `markdown-bubble${size}-${scheme}.png`) });
    }

    // The agent's text: a link, inline code, a paragraph and a list item wrap too.
    const agent = await chatRow(page, "a1");
    const md = agent.locator(".chat-markdown");
    const box = (await md.boundingBox())!;
    for (const part of [md.locator("p a").first(), md.locator("p code").first(), md.locator("p").nth(1), md.locator("li")]) {
      const b = (await part.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    // A code block does not wrap: it scrolls sideways.
    const pre = md.locator(".chat-markdown-codeblock[data-language=ts] pre");
    expect(await pre.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("pre");
    expect(await fits(pre)).toBe(false);

    // F8: hairlines above and between the rows; no frame and no header fill; no word cut in two.
    const frame = md.locator(".chat-markdown-table-container");
    const hairline = await token(page, "hairline", "color");
    expect(await frame.evaluate((e) => {
      const s = getComputedStyle(e);
      return [s.borderTopWidth, s.borderTopColor, s.borderLeftWidth, s.borderTopLeftRadius];
    })).toEqual(["1px", hairline, "0px", "0px"]);
    const th = frame.locator("th").first();
    expect(await th.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderBottomColor]))
      .toEqual(["rgba(0, 0, 0, 0)", hairline]);
    expect(await th.evaluate((e) => getComputedStyle(e).color)).toBe(await token(page, "dim", "color"));
    await expect(frame.locator("th")).toHaveText(["Name", "Column four", "A very wide table column header one", "Status", "Checked by"]);
    expect(await brokenWords(frame.locator("table"))).toEqual([]);
    if (w === 900) {
      // A table wider than the panel scrolls sideways inside its frame. With the redesign's narrow cells
      // this table fits at 900 px, so the frame is made narrow for the check.
      await frame.evaluate((e) => { e.style.width = "400px"; });
      expect(await fits(frame.locator("> div"))).toBe(false);
      await frame.evaluate((e) => { e.style.width = ""; });
    }

    // A diff shows its prefixes and indentation as code.
    const diff = md.locator(".chat-markdown-codeblock[data-language=diff] pre");
    const diffCode = diff.locator("code");
    await expect(diffCode).toContainText("--- a/src/a.ts");
    await expect(diffCode).toContainText("+++ b/src/a.ts");
    expect(await diffCode.textContent()).toContain("\n-const b = 2;\n+const b = 3;\n");
    await expect(diffCode.locator("*")).toHaveCount(0);

    for (const [name, part] of [["table", frame], ["diff", diff]] as const) {
      await part.evaluate((e) => e.scrollIntoView({ block: "end" }));
      for (const scheme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.screenshot({ path: path.join(shots, `markdown-${name}${size}-${scheme}.png`) });
      }
    }
  }
  await app.close();
});

test("raw HTML shows as its source; a missing picture shows its alt text; perm and question rows are chips", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/trace-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();

  // F15: the HTML block and inline HTML keep their source text; no element comes from them.
  const md = (await chatRow(page, "a1")).locator(".chat-markdown");
  expect(await md.locator("p").nth(1).innerText()).toBe("<div>\nraw html <b>bold</b>\n</div>");
  await expect(md.locator("p").nth(2)).toHaveText("Inline: a <kbd>Ctrl</kbd> key.");
  await expect(md.locator("b, kbd")).toHaveCount(0);
  // F15: a picture that cannot load: its alt text, else its path, as text; no broken image.
  await expect(md.locator("[data-missing-image]")).toHaveText(["build graph", "/nonexistent/no-alt.png"]);
  await expect(md.locator("img")).toHaveCount(0);

  // F17: a perm row is a chip (running, then done); a question row is a quiet note; an unknown kind is empty.
  await expect((await chatRow(page, "p1")).locator(".rounded-full")).toHaveText(/^.Running · Bash$/);
  await expect((await chatRow(page, "p2")).locator(".rounded-full")).toHaveText("Edit");
  const note = (await chatRow(page, "q1")).locator("span");
  await expect(note).toHaveText("The agent asks a question");
  expect(await note.evaluate((e) => getComputedStyle(e).color)).toBe(await token(page, "muted", "color"));
  await expect(await chatRow(page, "q2")).toHaveText("Question answered");
  await expect(await chatRow(page, "x1")).toHaveText("");

  await md.evaluate((e) => e.scrollIntoView({ block: "start" }));
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `markdown-trace-${scheme}.png`) });
  }
  await app.close();
});
