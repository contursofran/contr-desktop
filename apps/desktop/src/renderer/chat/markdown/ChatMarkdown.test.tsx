import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
