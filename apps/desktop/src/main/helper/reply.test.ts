import { expect, it } from "vitest";
import { readReplyInfo } from "./reply";

const model = [{ type: "model", agent: "claude", model: "claude-opus-5-5", effort: "low" }];
const status = [{ type: "status", tags: [{ kind: "model", text: "Opus 5.5" }, { kind: "context", percent: 37, text: "ctx 37%", warn: false }] }];
const commands = [
  {
    type: "commands",
    agent: "claude",
    commands: [
      { name: "model", args: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "opus" }] },
      { name: "effort", args: ["low", "high"] },
    ],
  },
];

it("reads model, effort, context and the menu's choices", () => {
  expect(readReplyInfo(model, status, commands)).toEqual({
    agent: "claude",
    model: "claude-opus-5-5",
    effort: "low",
    context: { percent: 37, text: "ctx 37%", warn: false },
    models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "opus", label: "opus" }],
    efforts: [{ value: "low", label: "low" }, { value: "high", label: "high" }],
  });
});

it("gives nulls and empty lists when the helper answers with errors", () => {
  const error = [{ type: "error", code: "helper" }];
  expect(readReplyInfo(error, error, error)).toEqual({ agent: null, model: null, effort: null, context: null, models: [], efforts: [] });
});

it("keeps the menu before the first reply: no model line, but commands", () => {
  const info = readReplyInfo([{ type: "model", agent: "claude", model: null, effort: null }], [], commands);
  expect(info.model).toBeNull();
  expect(info.models).toHaveLength(2);
});
