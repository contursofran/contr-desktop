import { describe, expect, it } from "vitest";
import type { ReplyInfo } from "../../../shared/api";
import { contextTip, menuCommand, modelLabel, modelTip, PENDING_MS, replyPlaceholder, serial, shown, speedChoices } from "./menu";

const info: ReplyInfo = {
  agent: "claude",
  model: "claude-opus-5-5",
  effort: "medium",
  tier: "fast",
  tiers: ["fast", "ultrafast"],
  speed: null,
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
  it("shows the helper's values with no choice", () => expect(shown(info, null, 0)).toEqual({ model: "claude-opus-5-5", effort: "medium", tier: "fast" }));
  it("shows a new choice at once", () =>
    expect(shown(info, { model: "opus", effort: "high", tier: "ultrafast", at: 0 }, 1000)).toEqual({ model: "opus", effort: "high", tier: "ultrafast" }));
  it("shows a pending switch to Standard over the old value", () =>
    expect(shown(info, { tier: "standard", at: 0 }, 1000).tier).toBe("standard"));
  it("drops a choice after PENDING_MS", () =>
    expect(shown(info, { model: "opus", tier: "ultrafast", at: 0 }, PENDING_MS)).toEqual({ model: "claude-opus-5-5", effort: "medium", tier: "fast" }));
});

describe("speedChoices", () => {
  it("gives no group for a model with no accelerated tier", () => expect(speedChoices([])).toEqual([]));
  it("puts Standard first and includes only the supported tiers in order", () => {
    expect(speedChoices(["ultrafast", "fast"]).map((choice) => choice.label)).toEqual(["Standard", "Fast", "Ultrafast"]);
    expect(speedChoices(["fast"]).map((choice) => choice.label)).toEqual(["Standard", "Fast"]);
    expect(speedChoices(["ultrafast"]).map((choice) => choice.label)).toEqual(["Standard", "Ultrafast"]);
  });
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

describe("tooltips and placeholder", () => {
  it("names model, effort and program", () => expect(modelTip("Opus 5.5", "medium", "claude")).toBe("Opus 5.5 · medium effort · Claude Code"));
  it("puts the accelerated tier after effort", () => expect(modelTip("Opus 5.5", "high", "claude", "fast")).toBe("Opus 5.5 · high effort · fast · Claude Code"));
  it("leaves out what is not known", () => expect(modelTip("Model", null, null)).toBe("Model"));
  it("shows another kind as it is", () => expect(modelTip("GPT-6", "high", "pi")).toBe("GPT-6 · high effort · pi"));
  it("says the context in plain words", () => expect(contextTip(37)).toBe("37% of the model's context window"));
  it("names the agent when the title is known", () => expect(replyPlaceholder("Chat panel usability audit")).toBe("Reply to Chat panel usability audit"));
  it("gives no name while the title is not known", () => {
    expect(replyPlaceholder("")).toBe("Reply");
    expect(replyPlaceholder("Terminal")).toBe("Reply");
  });
});
