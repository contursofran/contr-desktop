import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusGlyph } from "./StatusGlyph";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const rule = (state: string) => {
  const at = css.indexOf(`.status-glyph[data-state="${state}"]::before`);
  return css.slice(at, css.indexOf("}", at));
};

describe("StatusGlyph", () => {
  it("working: turns through the braille frames, in ink", () => {
    const out = renderToStaticMarkup(<StatusGlyph state="working" />);
    expect(out).toContain('data-state="working"');
    expect(out).toContain('aria-label="Working"');
    expect(out).toContain("text-ink-100");
    expect(rule("working")).toContain('content: "⠋"');
    expect(rule("working")).toContain("animation: status-braille");
  });
  it("waiting: ⠿ that pulses, in ink", () => {
    const out = renderToStaticMarkup(<StatusGlyph state="waiting" />);
    expect(out).toContain('aria-label="Waiting"');
    expect(out).toContain("text-ink-100");
    expect(rule("waiting")).toContain('content: "⠿"');
    expect(rule("waiting")).toContain("animation: status-pulse");
  });
  it("idle: ⠶, still and dim", () => {
    const out = renderToStaticMarkup(<StatusGlyph state="idle" />);
    expect(out).toContain('aria-label="Idle"');
    expect(out).toContain("text-ink-30");
    expect(rule("idle")).toContain('content: "⠶"');
    expect(rule("idle")).not.toContain("animation");
  });
  it("blocked: ⠿ that pulses, in red, the one color for needs you", () => {
    const out = renderToStaticMarkup(<StatusGlyph state="blocked" />);
    expect(out).toContain('aria-label="Needs you"');
    expect(out).toContain("text-blocked");
    expect(css).toMatch(/\.status-glyph\[data-state="blocked"\]::before \{ content: "⠿"; animation: status-pulse/);
  });
  it("done: ⠿, still and muted", () => {
    expect(renderToStaticMarkup(<StatusGlyph state="done" />)).toContain("text-ink-42");
    expect(rule("done")).toContain('content: "⠿"');
    expect(rule("done")).not.toContain("animation");
  });
  it("stops moving when the system asks for reduced motion", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.status-glyph::before \{ animation: none !important; \}/);
  });
});
