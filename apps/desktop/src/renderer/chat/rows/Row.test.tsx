import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedRow } from "../../../shared/api";
import { Row, oneLine } from "./Row";

const html = (row: Partial<FeedRow>) => renderToStaticMarkup(<Row row={{ id: "x", k: "", ...row } as FeedRow} />);

describe("Row", () => {
  it("draws a pending perm row as a running chip with its title", () => {
    const out = html({ k: "perm", text: "Bash", perm: { title: "Bash", tool: "Bash", state: "pending" } });
    expect(out).toContain("rounded-full");
    expect(out).toContain('role="status"');
    expect(out).toContain("Running · Bash");
  });

  it("draws a resolved perm row as a done chip; with no title it names the tool, else 'a tool'", () => {
    const out = html({ k: "perm", perm: { tool: "Edit", state: "resolved" } });
    expect(out).toContain('aria-label="done"');
    expect(out).toContain(">Edit<");
    expect(out).not.toContain("Running");
    expect(html({ k: "perm" })).toContain(">a tool<");
  });

  it("draws a question row as a quiet note, never as the question's text", () => {
    const pending = html({ k: "question", question: { state: "pending", questions: [{ text: "Pick a color?" }] } });
    expect(pending).toContain("The agent asks a question");
    expect(pending).toContain("text-muted");
    expect(pending).not.toContain("Pick a color?");
    expect(html({ k: "question", question: { state: "resolved" } })).toContain("Question answered");
  });

  it("draws a kind it does not know as an empty line, not as agent text", () => {
    const out = html({ k: "later-kind", text: "Allow Bash? pnpm test" });
    expect(out).not.toContain("Allow Bash");
    expect(out).toContain('data-kind="later-kind"');
  });

  it("oneLine keeps the first line with text and marks more", () => {
    expect(oneLine("\n  pnpm test\n\nmore")).toBe("pnpm test …");
    expect(oneLine("one\t line")).toBe("one  line");
    expect(oneLine(undefined)).toBe("");
  });
});
