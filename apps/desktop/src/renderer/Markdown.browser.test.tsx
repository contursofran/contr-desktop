import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import markdown from "../../e2e/fixtures/markdown-session.jsonl?raw";
import trace from "../../e2e/fixtures/trace-session.jsonl?raw";
import { renderApp } from "../../test/renderApp";

/** Wait for the virtual list to show the row after the initial jump to the end. */
async function chatRow(id: string) {
  const list = page.getByRole("list", { name: "Chat" });
  const el = await list.findElement();
  const row = () => el.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  await expect.poll(() => {
    const item = row();
    if (!item) {
      el.scrollTop = 0;
      return false;
    }
    item.scrollIntoView({ block: "nearest" });
    const box = item.getBoundingClientRect();
    const view = el.getBoundingClientRect();
    return box.bottom > view.top && box.top < view.bottom;
  }).toBe(true);
  return row()!;
}

/** True when no part of the element's content goes past its own box. */
const fits = (e: Element) => e.scrollWidth <= e.clientWidth + 1;

/** The computed color of a theme token, as the browser writes it. */
function token(name: string) {
  const probe = document.createElement("span");
  probe.style.color = `var(--color-${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** The words in the cells that a line break cuts in two (a word with more than one line box).
 * A break after a hyphen or a slash is a normal break, so those split the words here. */
function brokenWords(t: Element) {
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
}

test("long words wrap in the bubble and the text; tables have a frame; diffs use plain ink", async () => {
  await renderApp(markdown);
  await document.fonts.ready;

  for (const [w, h] of [
    [1200, 800],
    [900, 600],
  ] as const) {
    await page.viewport(w, h);
    expect(window.innerWidth).toBe(w);
    const size = w === 900 ? "-narrow" : "";

    // F5: the owner's bubble keeps a long URL and a long word inside it, and inside the window.
    const user = await chatRow("u1");
    const bubble = user.querySelector("p")!;
    expect(bubble.textContent).toContain("https://example.com/a/very/long/url");
    expect(fits(bubble)).toBe(true);
    expect(bubble.getBoundingClientRect().right).toBeLessThanOrEqual(w);
    for (const scheme of ["dark", "light"] as const) {
      await commands.colorScheme(scheme);
      await page.screenshot({ path: `../../../../tmp/shots/browser/markdown-bubble${size}-${scheme}.png` });
    }

    // The agent's text: a link, inline code, a paragraph and a list item wrap too.
    const agent = await chatRow("a1");
    const md = agent.querySelector(".chat-markdown")!;
    const box = md.getBoundingClientRect();
    for (const part of [md.querySelector("p a"), md.querySelector("p code"), md.querySelectorAll("p")[1], md.querySelector("li")]) {
      expect(part!.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 1);
    }
    // A code block does not wrap: it scrolls sideways.
    const pre = md.querySelector(".chat-markdown-codeblock[data-language=ts] pre")!;
    expect(getComputedStyle(pre).whiteSpace).toBe("pre");
    expect(fits(pre)).toBe(false);

    // F8: hairlines above and between the rows; no frame and no header fill; no word cut in two.
    const frame = md.querySelector<HTMLElement>(".chat-markdown-table-container")!;
    const hairline = token("hairline");
    const style = getComputedStyle(frame);
    expect([style.borderTopWidth, style.borderTopColor, style.borderLeftWidth, style.borderTopLeftRadius]).toEqual(["1px", hairline, "0px", "0px"]);
    const th = getComputedStyle(frame.querySelector("th")!);
    expect([th.backgroundColor, th.borderBottomColor])
      .toEqual(["rgba(0, 0, 0, 0)", hairline]);
    expect(th.color).toBe(token("dim"));
    expect(Array.from(frame.querySelectorAll("th"), (cell) => cell.textContent)).toEqual(["Name", "Column four", "A very wide table column header one", "Status", "Checked by"]);
    expect(brokenWords(frame.querySelector("table")!)).toEqual([]);
    if (w === 900) {
      // A table wider than the panel scrolls sideways inside its frame. With the redesign's narrow cells
      // this table fits at 900 px, so the frame is made narrow for the check.
      frame.style.width = "400px";
      expect(fits(frame.querySelector(":scope > div")!)).toBe(false);
      frame.style.width = "";
    }

    // A diff shows its prefixes and indentation as code.
    const diff = md.querySelector(".chat-markdown-codeblock[data-language=diff] pre")!;
    const diffCode = diff.querySelector("code")!;
    expect(diffCode.textContent).toContain("--- a/src/a.ts");
    expect(diffCode.textContent).toContain("+++ b/src/a.ts");
    expect(diffCode.textContent).toContain("\n-const b = 2;\n+const b = 3;\n");
    expect(diffCode.querySelectorAll("*")).toHaveLength(0);

    for (const [name, part] of [["table", frame], ["diff", diff]] as const) {
      part.scrollIntoView({ block: "end" });
      for (const scheme of ["dark", "light"] as const) {
        await commands.colorScheme(scheme);
        await page.screenshot({ path: `../../../../tmp/shots/browser/markdown-${name}${size}-${scheme}.png` });
      }
    }
  }
});

test("raw HTML shows as its source; a missing picture shows its alt text; perm and question rows are chips", async () => {
  await renderApp(trace);

  // F15: the HTML block and inline HTML keep their source text; no element comes from them.
  const md = (await chatRow("a1")).querySelector(".chat-markdown")!;
  expect(md.querySelectorAll("p")[1].innerText).toBe("<div>\nraw html <b>bold</b>\n</div>");
  expect(md.querySelectorAll("p")[2].textContent).toBe("Inline: a <kbd>Ctrl</kbd> key.");
  expect(md.querySelectorAll("b, kbd")).toHaveLength(0);
  // F15: a picture that cannot load: its alt text, else its path, as text; no broken image.
  await expect.poll(() => Array.from(md.querySelectorAll("[data-missing-image]"), (chip) => chip.textContent)).toEqual(["build graph", "/nonexistent/no-alt.png"]);
  expect(md.querySelectorAll("img")).toHaveLength(0);

  // F17: a perm row is a chip (running, then done); a question row is a quiet note; an unknown kind is empty.
  expect((await chatRow("p1")).querySelector(".rounded-full")?.textContent).toMatch(/^.Running · Bash$/);
  expect((await chatRow("p2")).querySelector(".rounded-full")?.textContent).toBe("Edit");
  const note = (await chatRow("q1")).querySelector("span")!;
  expect(note.textContent).toBe("The agent asks a question");
  expect(getComputedStyle(note).color).toBe(token("muted"));
  expect((await chatRow("q2")).textContent).toBe("Question answered");
  expect((await chatRow("x1")).textContent).toBe("");

  (await chatRow("a1")).scrollIntoView({ block: "start" });
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await page.screenshot({ path: `../../../../tmp/shots/browser/markdown-trace-${scheme}.png` });
  }
});
