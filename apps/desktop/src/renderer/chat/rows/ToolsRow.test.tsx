import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolsRow, foldText } from "./ToolsRow";

const call = (done = true, error = false) => ({ name: "Bash", summary: "ls", done, error });

describe("ToolsRow", () => {
  it("folds the chip labels into one line", () => {
    const chips = [
      { symbol: "doc.text", text: "Read 6 files", calls: [] },
      { symbol: "terminal", text: "Ran 3 commands", calls: [] },
      { symbol: "pencil", text: "Edited 2 files", calls: [] },
    ];
    expect(foldText(chips)).toBe("Read 6 files, ran 3 commands, edited 2 files");
    expect(foldText(chips.slice(1, 2))).toBe("Ran 3 commands");
    expect(foldText([])).toBe("");
  });
  it("is one closed button, with a spinner while a call runs", () => {
    const row = { id: "x", k: "tools", ts: 0, chips: [{ symbol: "terminal", text: "Running a command", calls: [call(false)] }] };
    const out = renderToStaticMarkup(<ToolsRow row={row as never} />);
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('role="img"');
    expect(out).toContain("Running a command");
    expect(out).not.toContain("<li");
  });
});
