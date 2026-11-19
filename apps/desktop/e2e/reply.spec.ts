import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

function launch(sendLog: string, env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: sendLog,
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    FAKE_HC_CWD: os.tmpdir(),
    ...env,
  });
}

const sent = (log: string) => !existsSync(log) ? [] : readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l).text as string);

test("the tier menu sends the helper arguments and reads back its acknowledgement", async () => {
  const log = test.info().outputPath("send.jsonl");
  const calls = test.info().outputPath("calls.jsonl");
  const ack = test.info().outputPath("tier.txt");
  const app = await launch(log, {
    FAKE_HELPER_TIERS: "ultrafast,fast",
    FAKE_HELPER_TIER: "fast",
    FAKE_HELPER_TIER_ACK: ack,
    FAKE_HELPER_CALL_LOG: calls,
  });
  try {
    const page = await app.firstWindow();
    const model = page.getByRole("button", { name: "Model" });
    const menu = page.getByRole("menu", { name: "Model" });
    await expect(model).toHaveAttribute("aria-haspopup", "menu");
    await model.click();
    await menu.getByRole("menuitemradio", { name: "Ultrafast" }).click();
    await expect.poll(() => readFileSync(calls, "utf8")).toContain(JSON.stringify(["tier", "--terminal", "t7", "--tier", "ultrafast"]));
    expect(sent(log)).toEqual([]);

    writeFileSync(ack, "ultrafast");
    await expect.poll(() => page.evaluate(async () => (await window.contr.replyInfo()).tier)).toBe("ultrafast");
    await model.click();
    await expect(menu.getByRole("menuitemradio", { name: "Ultrafast" })).toHaveAttribute("aria-checked", "true");
    await menu.getByRole("menuitemradio", { name: "Standard" }).click();
    await expect.poll(() => readFileSync(calls, "utf8")).toContain(JSON.stringify(["tier", "--terminal", "t7", "--tier", "standard"]));
  } finally {
    await app.close();
  }
});

test("the helper rejects a speed tier switch and reports the current tier", async () => {
  const log = test.info().outputPath("send.jsonl");
  const app = await launch(log, { FAKE_HELPER_TIER: "fast", FAKE_HELPER_TIERS: "fast,ultrafast", FAKE_HELPER_TIER_ERROR: "no_tier_switch" });
  try {
    const page = await app.firstWindow();
    const model = page.getByRole("button", { name: "Model" });
    const menu = page.getByRole("menu", { name: "Model" });
    await expect(model).toHaveAttribute("aria-haspopup", "menu");
    await model.click();
    await menu.getByRole("menuitemradio", { name: "Ultrafast" }).click();
    await expect(page.getByRole("alert")).toContainText("This agent cannot switch speed tiers.");
    await expect.poll(() => page.evaluate(async () => {
      const { tier, tiers } = await window.contr.replyInfo();
      return { tier, tiers };
    })).toEqual({ tier: "fast", tiers: [] });
  } finally {
    await app.close();
  }
});

test("the model menu sends /model and /effort through the helper", async () => {
  const log = test.info().outputPath("send.jsonl");
  const app = await launch(log);
  try {
    const page = await app.firstWindow();
    const model = page.getByRole("button", { name: "Model" });
    const menu = page.getByRole("menu", { name: "Model" });
    await expect(model).toHaveAttribute("aria-haspopup", "menu");
    await model.click();
    await menu.getByRole("menuitemradio", { name: "Sonnet 5" }).click();
    await expect.poll(() => sent(log)).toEqual(["/model claude-sonnet-5"]);
    await model.click();
    await menu.getByRole("menuitemradio", { name: "high" }).click();
    await expect.poll(() => sent(log)).toEqual(["/model claude-sonnet-5", "/effort high"]);
  } finally {
    await app.close();
  }
});
