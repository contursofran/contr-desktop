import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StateMark } from "./Marks";

describe("StateMark", () => {
  it("draws the idle ring in `faint`, a non-text mark (#102)", () => {
    expect(renderToStaticMarkup(createElement(StateMark, { state: "idle", label: "idle" }))).toContain("border-[var(--color-faint)]");
  });
});
