import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchIcon, WrenchIcon } from "lucide-react";
import { ToolsRow, chipIcon } from "./ToolsRow";

describe("ToolsRow", () => {
  it("maps SF Symbol names to lucide icons, with a wrench for others", () => {
    expect(chipIcon("magnifyingglass")).toBe(SearchIcon);
    expect(chipIcon("hammer")).toBe(WrenchIcon);
  });
  it("shows a spinner in place of the icon while a call runs", () => {
    const row = { id: "x", k: "tools", ts: 0, chips: [{ symbol: "terminal", text: "Running a command", calls: [{ name: "Bash", summary: "ls", done: false, error: false }] }] };
    const out = renderToStaticMarkup(<ToolsRow row={row as never} />);
    expect(out).toContain('role="status"');
    expect(out).not.toContain("lucide-square-terminal");
  });
});
