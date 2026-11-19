import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { launchApp } from "./launch";

test("Codex starts with its defaults and applies composer options to the next turn", async () => {
  const log = test.info().outputPath("codex-options.jsonl");
  mkdirSync(path.dirname(log), { recursive: true });
  const app = await launchApp({ CONTR_TERMINAL: "", FAKE_CODEX_OPTIONS_LOG: log });
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name: "Codex" }).click();

    const model = page.getByRole("button", { name: "Model" });
    const option = (name: string) => page.getByRole("menuitemradio", { name, exact: true });
    const reply = page.getByRole("textbox", { name: /^Reply to / });
    const transcript = () => readFileSync(log, "utf8").trim().split("\n").map((line) =>
      JSON.parse(line) as { method: string; params: Record<string, unknown> },
    );
    const send = async (text: string, turn: number) => {
      await reply.fill(text);
      await reply.press("Enter");
      await expect(page.getByText(`Turn ${turn} completed.`)).toBeVisible();
      return transcript().filter((call) => call.method === "turn/start")[turn - 1].params;
    };
    const choose = async (label: string) => {
      await model.click();
      await option(label).click();
      await expect(option(label)).toHaveCount(0);
    };
    await expect(model).toHaveText(/GPT Test\s*high\s*fast\s*Workspace/);
    await model.click();
    for (const name of ["GPT Test", "high", "Fast", "Workspace"]) {
      await expect(option(name)).toHaveAttribute("aria-checked", "true");
    }
    await expect(option("Full access")).toHaveCount(0);
    await expect(option("Ultrafast")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const initial = await send("Use the configured defaults.", 1);
    await expect(page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: /Use the configured defaults/ })).toBeVisible();
    const start = transcript().find(({ method }) => method === "thread/start")!.params;
    for (const field of ["model", "serviceTier", "permissions", "approvalPolicy", "effort", "reasoningEffort"]) {
      expect(initial).not.toHaveProperty(field);
      expect(start).not.toHaveProperty(field);
    }

    await choose("GPT Next");
    await expect(model).toHaveText(/GPT Next\s*medium\s*Workspace/);
    await model.click();
    await expect(option("Fast")).toHaveCount(0);
    await expect(option("Standard")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await choose("low");
    await choose("Read-only");
    await choose("Ultrafast");
    await expect(model).toHaveText(/GPT Next\s*low\s*ultrafast\s*Read-only/);
    expect(await send("Use the selected options.", 2)).toMatchObject({
      threadId: initial.threadId, model: "gpt-test-next", effort: "low", permissions: ":read-only", serviceTier: "ultrafast",
    });

    for (const [width, height] of [[640, 480], [1400, 900]]) {
      await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w, h), [width, height]);
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
      await model.click();
      await expect(option("Ultrafast")).toHaveAttribute("aria-checked", "true");
      await expect(option("Read-only")).toHaveAttribute("aria-checked", "true");
      await page.screenshot({ path: path.resolve(import.meta.dirname, "../../../tmp/shots", `344-codex-options-${width}.png`) });
      await page.keyboard.press("Escape");
    }
    await choose("Standard");
    await expect(model).toHaveText(/GPT Next\s*low\s*Read-only/);
    expect(await send("Switch back to Standard.", 3)).toMatchObject({ serviceTier: "default", permissions: ":read-only" });
  } finally {
    await app.close();
  }
});
