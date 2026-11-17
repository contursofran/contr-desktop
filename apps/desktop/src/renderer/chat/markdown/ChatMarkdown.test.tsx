import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatMarkdown } from "./ChatMarkdown";

const html = (text: string) => renderToStaticMarkup(<ChatMarkdown text={text} />);

describe("ChatMarkdown", () => {
  it("renders headings, task lists and tables", () => {
    const out = html("## Next\n\n- [x] done\n- [ ] open\n\n| A | B |\n|---|--:|\n| x | 1 |");
    expect(out).toContain("<h2>Next</h2>");
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('class="chat-markdown-table-container"');
    expect(out).toContain('<td style="text-align:right">1</td>');
  });

  it("tags inline code and drops raw HTML and unsafe links", () => {
    const out = html("Use `pnpm` <script>alert(1)</script> [x](javascript:alert(1))");
    expect(out).toContain('<code data-inline-code="">pnpm</code>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("javascript:");
  });

  it("colors added and removed lines of a diff or patch fence; headers and @@ stay neutral", () => {
    for (const lang of ["diff", "patch"]) {
      const out = html("```" + lang + "\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n same\n-old\n+new\n```");
      expect(out).toContain('class="chat-diff"');
      const kinds = [...out.matchAll(/data-diff="(\w+)">([^<\n]*)/g)].map((m) => `${m[1]} ${m[2]}`);
      expect(kinds).toEqual(["meta --- a/x.ts", "meta +++ b/x.ts", "meta @@ -1 +1 @@", "context  same", "del -old", "add +new"]);
    }
    expect(html("```ts\n-x\n```")).not.toContain("data-diff");
  });

  it("opens web links outside the app", () => {
    expect(html("[t3](https://example.com)")).toContain('target="_blank"');
  });
});

vi.mock("./useColorScheme", () => ({ useColorScheme: () => "dark" }));

vi.mock("../refs/useRef", () => ({
  useRefState: (n: number) =>
    ({
      12: { kind: "pr", state: "merged", url: "https://github.com/o/r/pull/12" },
      9: { kind: "issue", state: "not-planned", url: "https://github.com/o/r/issues/9" },
      404: null,
    })[n],
}));

describe("PR and issue chips", () => {
  const chip = (n: number, state: string) => new RegExp(`<a [^>]*href="[^"]*/${n}"[^>]*data-ref-state="${state}"`);

  it("turns #12 into a chip in text, list items, table cells and emphasis", () => {
    for (const text of ["See #12.", "- see #12", "| PR |\n|---|\n| #12 |", "*(#12)*"]) {
      const out = html(text);
      expect(out).toMatch(chip(12, "merged"));
      expect(out).toContain('aria-label="PR #12, Merged"');
      expect(out).toContain(">#12</span></a>");
    }
    expect(html("Fixes #9")).toMatch(chip(9, "not-planned"));
  });

  it("keeps code, links, unknown numbers and non-references as text", () => {
    for (const text of ["`#12`", "[see #12](https://example.com)", "#404", "a#12 &#12; x/#12 #12a", "#13"]) {
      expect(html(text)).not.toContain("data-ref-state");
    }
    expect(html("`#12`")).toContain("<code data-inline-code=\"\">#12</code>");
  });
});

describe("remarks", () => {
  it.each([
    ["DONE", "done", "Done"],
    ["DECISION", "decision", "Decision needed"],
    ["WARNING", "warning", "Warning"],
    ["UNVERIFIED", "unverified", "Not verified"],
    ["NOTE", "note", "Note"],
    ["TIP", "tip", "Tip"],
    ["CAUTION", "caution", "Caution"],
  ])("shows [!%s] with its word", (tag, alert, word) => {
    const out = html(`> [!${tag}]\n> Body text`);
    expect(out).toContain(`data-alert="${alert}" class="chat-remark"`);
    expect(out).toContain(`<p class="chat-remark-word">${word}</p>`);
    expect(out).toContain("Body text");
    expect(out).not.toContain("[!");
  });

  it("keeps a plain quote and an unknown tag as a quote", () => {
    expect(html("> just a quote")).toBe('<div class="chat-markdown"><blockquote>\n<p>just a quote</p>\n</blockquote></div>');
    expect(html("> [!OTHER]\n> x")).not.toContain("chat-remark");
  });
});

describe("images", () => {
  it("draws a local PNG, JPEG or SVG alone on its line through contr-image", () => {
    expect(html("![shot](</tmp/a b.png>)")).toContain('<img src="contr-image://local/tmp/a%20b.png" alt="shot"/>');
    expect(html("![j](/x/y.jpeg)")).toContain('src="contr-image://local/x/y.jpeg"');
    expect(html("![s](/x/y.svg)")).toContain('src="contr-image://local/x/y.svg"');
  });

  it("keeps web URLs, other files and inline images as links", () => {
    for (const md of ["![web](https://example.com/a.png)", "![t](/etc/passwd)", "See ![x](/tmp/a.png) here", "![r](a.png)"]) {
      const out = html(md);
      expect(out).not.toContain("<img");
      expect(out).toContain("<a ");
    }
  });
});
