import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentIcon } from "./AgentIcon";

describe("AgentIcon", () => {
  it("draws Claude Code in its own color, not the state color (Herdr: tint false)", () => {
    const out = renderToStaticMarkup(<AgentIcon kind="claude-code" size={15} color="var(--color-working)" />);
    expect(out).toContain('fill="#D97757"');
    expect(out).not.toContain("currentColor");
    expect(out).not.toContain("var(--color-working)");
    expect(out).not.toContain("<title>");
    expect(out).not.toContain("<!--");
  });
  it("draws Codex with its own fill and gradient", () => {
    const out = renderToStaticMarkup(<AgentIcon kind="codex" size={14} color="var(--color-muted)" />);
    expect(out).toContain('fill="#fff"');
    expect(out).toContain("linearGradient");
    expect(out).toContain('width="100%"');
  });
  it("draws a one-color bot in the given color for a kind with no picture", () => {
    for (const kind of [null, "aider"]) {
      const out = renderToStaticMarkup(<AgentIcon kind={kind} size={13} color="var(--color-done)" />);
      expect(out).toContain('data-icon="agent"');
      expect(out).toContain("color:var(--color-done)");
    }
  });
});
