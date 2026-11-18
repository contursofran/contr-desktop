import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The design-system tokens as tokens.css sets them: dark in the first `:root`, light in the
// `prefers-color-scheme: light` block. Ink is rgba: it is mixed over the surface before the check.
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const block = (start: string) => {
  const at = css.indexOf(start);
  return css.slice(at, css.indexOf("}", at));
};
const dark = block(":root {");
const light = block("@media (prefers-color-scheme: light)");
const index = readFileSync(new URL("./index.css", import.meta.url), "utf8");

type Rgba = [number, number, number, number];
const token = (part: string, name: string): Rgba => {
  const m = part.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`no --${name}`);
  const v = m[1]!.trim();
  if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1) as Rgba;
  const n = v.match(/rgba\(([^)]+)\)/)![1]!.split(",").map(Number);
  return [n[0]!, n[1]!, n[2]!, n[3]!];
};
const over = (top: Rgba, ground: Rgba): Rgba => [0, 1, 2].map((i) => top[i]! * top[3] + ground[i]! * (1 - top[3])).concat(1) as Rgba;

// WCAG 2 relative luminance and contrast ratio.
const luminance = (c: Rgba) => {
  const [r, g, b] = c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Each Tailwind name that is text points at an ink of tokens.css (index.css `@theme`).
const textInk = (name: string) => index.match(new RegExp(`--color-${name}: var\\(--([a-z0-9-]+)\\);`))![1]!;

describe("light theme contrast", () => {
  const surfaces = ["win", "side", "float"];
  for (const text of ["foreground", "muted", "dim", "error"]) {
    for (const surface of surfaces) {
      it(`${text} text reaches 4.5:1 on ${surface}`, () => {
        const ground = token(light, surface);
        expect(contrast(over(token(light, textInk(text)), ground), ground)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("muted is clearly stronger than dim", () => {
    const win = token(light, "win");
    const muted = contrast(over(token(light, textInk("muted")), win), win);
    const dimmed = contrast(over(token(light, textInk("dim")), win), win);
    expect(muted - dimmed).toBeGreaterThanOrEqual(0.5);
  });
});

describe("dark theme", () => {
  it("text on the window reaches 4.5:1", () => {
    const win = token(dark, "win");
    for (const text of ["foreground", "muted", "dim"]) {
      expect(contrast(over(token(dark, textInk(text)), win), win)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
