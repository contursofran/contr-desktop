import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RefState } from "../../../shared/api";
import { RefChip } from "./RefChip";

let ref: RefState | null = null;
vi.mock("./useRef", () => ({ useRefState: () => ref }));

const chip = (state: RefState) => {
  ref = state;
  return renderToStaticMarkup(<RefChip number={7}>#7</RefChip>);
};
const pr = (state: Extract<RefState, { kind: "pr" }>["state"]) => chip({ kind: "pr", state, url: "https://github.com/o/r/pull/7" });
const issue = (state: Extract<RefState, { kind: "issue" }>["state"]) => chip({ kind: "issue", state, url: "https://github.com/o/r/issues/7" });

describe("RefChip", () => {
  // Each state: its label, the token on the icon and the outline, and the number in ink or dim.
  it.each([
    ["PR open", () => pr("open"), "PR #7, Open", "--color-pr-open", "text-ink-100", "lucide-git-pull-request-arrow"],
    ["PR draft", () => pr("draft"), "PR #7, Draft", "--color-pr-draft", "text-ink-100", "lucide-git-pull-request-draft"],
    ["PR merged", () => pr("merged"), "PR #7, Merged", "--color-pr-merged", "text-ink-100", "lucide-git-merge"],
    // Grey, not red: red only means "needs you".
    ["PR closed", () => pr("closed"), "PR #7, Closed", "--color-pr-draft", "text-dim", "lucide-git-pull-request-closed"],
    ["issue open", () => issue("open"), "Issue #7, Open", "--color-issue-open", "text-ink-100", "lucide-circle-dot"],
    ["issue closed", () => issue("closed"), "Issue #7, Closed", "--color-issue-done", "text-ink-100", "lucide-circle-check"],
    ["issue not planned", () => issue("not-planned"), "Issue #7, Not planned", "--color-issue-notplanned", "text-dim", "lucide-circle-slash"],
  ])("draws %s", (_, render, label, token, ink, icon) => {
    const out = render();
    expect(out).toContain(`aria-label="${label}"`);
    expect(out).toContain(`[--st:var(${token})]`);
    expect(out).toContain("shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--st)_38%,transparent)]");
    expect(out).toContain(` ${ink} `);
    expect(out).toContain(icon);
    expect(out).toContain('href="https://github.com/o/r/');
    expect(out).toContain(">#7</span></a>");
  });

  it("never colors a chip red", () => {
    for (const out of [pr("open"), pr("draft"), pr("merged"), pr("closed"), issue("open"), issue("closed"), issue("not-planned")]) {
      expect(out).not.toContain("pr-closed");
      expect(out).not.toContain("blocked");
    }
  });

  it("stays text while gh does not know the number", () => {
    ref = null;
    expect(renderToStaticMarkup(<RefChip number={7}>#7</RefChip>)).toBe("#7");
  });
});
