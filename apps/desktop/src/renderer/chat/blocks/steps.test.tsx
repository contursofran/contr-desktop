import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stepOf, type StepInput } from "./steps";
import { RunningLine, StepMarks } from "./StatusBlock";

describe("stepOf", () => {
  it.each<[string, StepInput, { done: number; current: number | null; word: string | null; you: boolean }]>([
    ["a planner with no PR plans", { state: "working", role: "planner-high" }, { done: 0, current: 0, word: "plan", you: false }],
    ["a builder with no PR builds", { state: "working", role: "builder-medium" }, { done: 1, current: 1, word: "build", you: false }],
    ["a PR with no checks", { state: "working", role: "builder", pr: { state: "draft", checks: null } }, { done: 2, current: 2, word: "PR", you: false }],
    ["running checks", { state: "working", pr: { state: "open", checks: "pending" } }, { done: 3, current: 3, word: "CI", you: false }],
    ["failed checks", { state: "idle", pr: { state: "open", checks: "fail" } }, { done: 3, current: 3, word: "CI fails", you: false }],
    ["passed checks: no review data, so no step now", { state: "working", pr: { state: "open", checks: "pass" } }, { done: 4, current: null, word: "CI passed", you: false }],
    ["a reviewer reviews", { state: "working", role: "reviewer", pr: { state: "open", checks: "fail" } }, { done: 4, current: 4, word: "review", you: false }],
    ["a merged PR", { state: "done", pr: { state: "merged", checks: "pass" } }, { done: 6, current: null, word: "merged", you: false }],
    ["a closed PR", { state: "done", pr: { state: "closed", checks: null } }, { done: 2, current: null, word: "closed", you: false }],
    ["no role and no PR: no step", { state: "working", role: "debugger" }, { done: 0, current: null, word: null, you: false }],
    ["nothing known", {}, { done: 0, current: null, word: null, you: false }],
    ["a blocked builder asks the owner at its step", { state: "blocked", role: "builder" }, { done: 1, current: 1, word: "asks you", you: true }],
    ["a blocked worker with passed checks asks at the next step", { state: "blocked", pr: { state: "open", checks: "pass" } }, { done: 4, current: 4, word: "asks you", you: true }],
    ["a blocked worker with no step asks at the first", { state: "blocked" }, { done: 0, current: 0, word: "asks you", you: true }],
  ])("%s", (_, input, step) => expect(stepOf(input)).toEqual(step));
});

describe("StepMarks", () => {
  const marks = (html: string) => [...html.matchAll(/data-mark="(\w+)"/g)].map((m) => m[1]);
  it("draws six marks and the word", () => {
    const out = renderToStaticMarkup(<StepMarks step={{ done: 3, current: 3, word: "CI", you: false }} working />);
    expect(marks(out)).toEqual(["done", "done", "done", "now", "todo", "todo"]);
    expect(out).toContain('aria-label="Step: CI, 3 of 6 done"');
    expect(out).toContain("motion-safe:animate-pulse");
    expect(out).not.toContain("bg-blocked");
  });
  it("draws the step that waits for the owner in red, and does not pulse an idle worker", () => {
    const out = renderToStaticMarkup(<StepMarks step={{ done: 1, current: 1, word: "asks you", you: true }} working={false} />);
    expect(marks(out)).toEqual(["done", "now", "todo", "todo", "todo", "todo"]);
    expect(out).toContain("bg-blocked");
    expect(out).toContain("text-blocked");
    expect(out).not.toContain("animate-pulse");
  });
  it("says when the step is not known", () => {
    const out = renderToStaticMarkup(<StepMarks step={{ done: 0, current: null, word: null, you: false }} working />);
    expect(marks(out)).toEqual(Array(6).fill("todo"));
    expect(out).toContain('aria-label="Step not known"');
  });
});

describe("RunningLine", () => {
  it("draws one line of worker chips, and a name the tool does not know as text", () => {
    const lines = [
      { worker: "p-112", issue: 112, text: "History check" },
      { worker: "b-202", issue: 202, text: "Capture tools" },
      { worker: "b-9", issue: 9, text: "Gone" },
    ];
    const out = renderToStaticMarkup(<RunningLine lines={lines} workers={{ "p-112": "working", "b-202": "blocked" }} />);
    expect(out).toMatch(/^<p [^>]*>Running, no change:/);
    expect(out).toContain('aria-label="Worker p-112, working"');
    expect(out).toContain('aria-label="Worker b-202, blocked"');
    expect(out).not.toContain("Worker b-9");
    expect(out).toContain(">b-9</span>");
  });
});
