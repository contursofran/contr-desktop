import { describe, expect, it } from "vitest";
import type { ReplyInfo } from "../../../shared/api";
import { menuCommand, modelLabel, PENDING_MS, serial, shown } from "./menu";

const info: ReplyInfo = {
  agent: "claude",
  model: "claude-opus-5-5",
  effort: "medium",
  context: null,
  models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "opus", label: "The latest Opus" }],
  efforts: [],
};

describe("modelLabel", () => {
  it("takes the label from the list", () => expect(modelLabel("claude-opus-5-5", info.models)).toBe("Opus 5.5"));
  it("shows the id when the list has no label", () => expect(modelLabel("claude-x", info.models)).toBe("claude-x"));
  it("shows Model when the model is not known", () => expect(modelLabel(null, info.models)).toBe("Model"));
});

describe("shown", () => {
  it("shows the helper's values with no choice", () => expect(shown(info, null, 0)).toEqual({ model: "claude-opus-5-5", effort: "medium" }));
  it("shows a new choice at once", () =>
    expect(shown(info, { model: "opus", effort: "high", at: 0 }, 1000)).toEqual({ model: "opus", effort: "high" }));
  it("drops a choice after PENDING_MS", () =>
    expect(shown(info, { model: "opus", at: 0 }, PENDING_MS)).toEqual({ model: "claude-opus-5-5", effort: "medium" }));
});

it("menuCommand writes the slash command", () => {
  expect(menuCommand("model", "opus")).toBe("/model opus");
  expect(menuCommand("effort", "high")).toBe("/effort high");
});

it("serial runs a task after the one before ends, also after a failure", async () => {
  const run = serial();
  const order: string[] = [];
  let release!: () => void;
  const first = run(() => new Promise<void>((r) => (release = r)).then(() => { order.push("send"); throw new Error("x"); }));
  const second = run(async () => { order.push("model"); });
  await Promise.resolve();
  expect(order).toEqual([]);
  release();
  await first.catch(() => undefined);
  await second;
  expect(order).toEqual(["send", "model"]);
});
