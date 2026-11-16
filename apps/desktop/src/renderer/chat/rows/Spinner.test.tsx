import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FRAME_MS, FRAMES, Spinner } from "./Spinner";

describe("Spinner", () => {
  it("is herdr-contr's braille loader: its frames, 80 ms each", () => {
    expect([...FRAMES]).toEqual(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]);
    expect(FRAME_MS).toBe(80);
  });
  it("is a square of the given size, in Menlo at that size", () => {
    const out = renderToStaticMarkup(<Spinner size={12} className="text-working" />);
    expect(out).toContain("width:12px;height:12px;font-size:12px");
    expect(out).toContain("font-[Menlo,monospace]");
    expect(out).toContain("text-working");
    expect(out).toContain("⠋");
  });
});
