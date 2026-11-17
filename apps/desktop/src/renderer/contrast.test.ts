import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The theme tokens as index.css sets them: dark in `@theme`, light in the `prefers-color-scheme: light` block.
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const block = (start: string) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));
const token = (part: string, name: string) => {
  const m = part.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!m) throw new Error(`no --color-${name}`);
  return m[1];
};
const dark = block("@theme {");
const light = block("@media (prefers-color-scheme: light)");

// WCAG 2 relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("light theme contrast", () => {
  for (const text of ["muted", "dim"]) {
    for (const surface of ["canvas", "chrome", "raised"]) {
      it(`${text} text reaches 4.5:1 on ${surface}`, () => {
        expect(contrast(token(light, text), token(light, surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const surface of ["canvas", "chrome", "raised"]) {
    it(`error text reaches 4.5:1 on ${surface}`, () => {
      expect(contrast(token(light, "error"), token(light, surface))).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("muted is clearly stronger than dim", () => {
    expect(luminance(token(light, "muted"))).toBeLessThan(luminance(token(light, "dim")));
    expect(contrast(token(light, "muted"), token(light, "canvas")) - contrast(token(light, "dim"), token(light, "canvas"))).toBeGreaterThanOrEqual(0.5);
  });
  it("faint keeps the theme file's pale value; the dark theme does not change", () => {
    expect(token(light, "faint")).toBe("#a1a1a6");
    expect(token(dark, "muted")).toBe("#9a9a9a");
    expect(token(dark, "dim")).toBe("#6a6a6a");
    expect(token(dark, "faint")).toBe("#6a6a6a");
    expect(token(dark, "error")).toBe(token(dark, "blocked"));
  });
});
