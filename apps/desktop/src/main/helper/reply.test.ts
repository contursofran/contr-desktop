import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { cachedCommands, readReplyInfo, setReplyTier } from "./reply";

const model = [{ type: "model", agent: "claude", model: "claude-opus-5-5", effort: "low", tier: "fast" }];
const status = [{ type: "status", tags: [{ kind: "model", text: "Opus 5.5" }, { kind: "context", percent: 37, text: "ctx 37%", warn: false }, { kind: "speed", text: "58 tok/s", warn: false }] }];
const commands = [
  {
    type: "commands",
    agent: "claude",
    commands: [
      { name: "model", args: [{ value: "claude-opus-5-5", label: "Opus 5.5", tiers: ["fast", "ultrafast"] }, { value: "opus" }] },
      { name: "effort", args: ["low", "high"] },
    ],
  },
];

it("reads model, effort, tier, context, output speed and the menu's choices", () => {
  expect(readReplyInfo(model, status, commands)).toEqual({
    agent: "claude",
    model: "claude-opus-5-5",
    effort: "low",
    tier: "fast",
    tiers: ["fast", "ultrafast"],
    speed: "58 tok/s",
    context: { percent: 37, text: "ctx 37%", warn: false },
    models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "opus", label: "opus" }],
    efforts: [{ value: "low", label: "low" }, { value: "high", label: "high" }],
  });
});

it("gives nulls and empty lists when the helper answers with errors", () => {
  const error = [{ type: "error", code: "helper" }];
  expect(readReplyInfo(error, error, error)).toEqual({ agent: null, model: null, effort: null, tier: null, tiers: [], speed: null, context: null, models: [], efforts: [] });
});

it("keeps another tier from the model line and gives no choices or output speed without the fields", () => {
  const info = readReplyInfo([{ ...model[0], model: "opus", tier: "other" }], [{ type: "status", tags: [{ kind: "tier", text: "fast" }] }], commands);
  expect(info).toMatchObject({ tier: "other", tiers: [], speed: null });
});

it("keeps the menu before the first reply: no model line, but commands", () => {
  const info = readReplyInfo([{ type: "model", agent: "claude", model: null, effort: null }], [], commands);
  expect(info.model).toBeNull();
  expect(info.tiers).toEqual([]);
  expect(info.models).toHaveLength(2);
});

describe("setReplyTier", () => {
  const fake = fileURLToPath(new URL("../../../e2e/fake-helper.mjs", import.meta.url));
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the helper's unchanged result", async () => {
    vi.stubEnv("FAKE_HELPER_TIER", "fast");
    expect(await setReplyTier(fake, "t7", "fast")).toEqual({ ok: true });
  });

  it.each(["unknown_tier", "unsupported_tier", "no_tier_switch"])("returns the helper's %s error", async (code) => {
    vi.stubEnv("FAKE_HELPER_TIER_ERROR", code);
    expect(await setReplyTier(fake, "t7", "ultrafast")).toEqual({ ok: false, message: "This agent cannot switch speed tiers." });
  });
});

describe("cachedCommands", () => {
  it("asks again after an error answer and keeps the first good answer", async () => {
    const answers = [[{ type: "error", code: "no-core", message: "down" }], commands, [{ type: "commands", commands: [] }]];
    const calls: string[] = [];
    const get = cachedCommands(async (terminal) => { calls.push(terminal); return answers[calls.length - 1]; });
    expect(await get("t1")).toEqual(answers[0]);
    await Promise.resolve();
    expect(await get("t1")).toEqual(commands);
    expect(await get("t1")).toEqual(commands);
    expect(calls).toEqual(["t1", "t1"]);
  });
});
