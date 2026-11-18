import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OwnerQuestion, OwnerTodo } from "../../../shared/api";
import { DecisionChip } from "./DecisionChip";
import { FileChip } from "./FileChip";
import { OwnerChip } from "./OwnerChip";
import { WorkerChip } from "./WorkerChip";

const NEUTRAL = "shadow-[inset_0_0_0_1px_var(--hairline)]";
const RED = "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--blocked)_35%,transparent)]";

describe("WorkerChip", () => {
  it.each([
    ["working", 'data-state="working"'],
    ["blocked", 'data-state="blocked"'],
    ["idle", 'data-state="idle"'],
  ] as const)("draws a %s worker with its glyph", (state, glyph) => {
    const out = renderToStaticMarkup(<WorkerChip name="b-31" state={state} />);
    expect(out).toContain(`aria-label="Worker b-31, ${state}"`);
    expect(out).toContain(glyph);
    expect(out).toContain(NEUTRAL);
    expect(out).toMatch(/<\/span>b-31<\/span>$/);
  });

  it("draws a done worker with no glyph", () => {
    const out = renderToStaticMarkup(<WorkerChip name="b-31" state="done" />);
    expect(out).toContain('aria-label="Worker b-31, done"');
    expect(out).not.toContain("status-glyph");
  });
});

describe("OwnerChip", () => {
  const question: OwnerQuestion = { id: "D7", coordinator: "t7", order: 0, title: "Block or row?", from: "b-15", question: "?", options: [], refs: [] };
  const todo: OwnerTodo = { id: "T3", coordinator: "t7", order: 1, from: "b-15", text: "Log in", know: false };

  it("draws an open question with its title and a red outline", () => {
    const out = renderToStaticMarkup(<OwnerChip item={question} open />);
    expect(out).toContain('aria-label="Question D7, Block or row?, open"');
    expect(out).toContain(RED);
    expect(out).toContain("lucide-circle-question-mark");
    expect(out).toContain('D7<span class="ms-[5px] font-sans text-ink-85">Block or row?</span>');
  });

  it("draws an open to-do with no title", () => {
    const out = renderToStaticMarkup(<OwnerChip item={todo} open />);
    expect(out).toContain('aria-label="To-do T3, open"');
    expect(out).toContain(RED);
    expect(out).toContain("lucide-square");
    expect(out).toMatch(/<\/svg>T3<\/span>$/);
  });

  it("draws a closed item with the neutral outline, not red", () => {
    const out = renderToStaticMarkup(<OwnerChip item={todo} open={false} />);
    expect(out).toContain('aria-label="To-do T3, closed"');
    expect(out).toContain(NEUTRAL);
    expect(out).not.toContain("blocked");
  });
});

describe("DecisionChip", () => {
  it("draws the id in mono with the neutral outline and no icon", () => {
    const out = renderToStaticMarkup(<DecisionChip id="D112" />);
    expect(out).toContain('aria-label="Decision D112"');
    expect(out).toContain("font-mono");
    expect(out).toContain(NEUTRAL);
    expect(out).not.toContain("<svg");
    expect(out).toMatch(/>D112<\/span>$/);
  });
});

describe("FileChip", () => {
  it("draws the path with a file icon", () => {
    const out = renderToStaticMarkup(<FileChip path="e2e/keys.spec.ts:88" />);
    expect(out).toContain('aria-label="File e2e/keys.spec.ts:88"');
    expect(out).toContain("lucide-file");
    expect(out).toContain(NEUTRAL);
    expect(out).toMatch(/<\/svg>e2e\/keys.spec.ts:88<\/span>$/);
  });
});
