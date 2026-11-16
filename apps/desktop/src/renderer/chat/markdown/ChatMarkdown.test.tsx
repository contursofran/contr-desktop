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

  it("opens web links outside the app", () => {
    expect(html("[t3](https://example.com)")).toContain('target="_blank"');
  });
});

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
