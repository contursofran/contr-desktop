import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { launchApp } from "./launch";

test("a Codex chat starts an hc worker and receives its report after the active turn", async () => {
  const info = test.info();
  const cwd = info.outputPath("profile");
  const hcList = info.outputPath("hc.json");
  const orchList = info.outputPath("workers.json");
  const log = info.outputPath("hc-run.jsonl");
  mkdirSync(cwd, { recursive: true });
  writeFileSync(hcList, JSON.stringify({
    terminals: [{ address: "t7", cwd, title: "Claude Code coordinator", state: "live", status: "idle", agent: "claude-code" }],
  }));
  writeFileSync(orchList, "[]");
  const env = {
    CONTR_TERMINAL: "t7",
    CONTR_ORCH: path.join(import.meta.dirname, "fake-orch.mjs"),
    FAKE_CODEX_ORCHESTRATION: "1",
    FAKE_HC_LIST: hcList,
    FAKE_HC_RUN_LOG: log,
    FAKE_ORCH_LIST: orchList,
  };
  const app = await launchApp(env, cwd);
  try {
    const page = await app.firstWindow();
    const projects = page.getByRole("navigation", { name: "Projects" });
    await projects.getByRole("button", { name: "Claude Code coordinator" }).waitFor();
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name: "Codex" }).click();
    const reply = page.getByRole("textbox", { name: /^Reply to / });
    await reply.fill("Review the release");
    await reply.press("Enter");
    await expect(page.getByText("Ready to coordinate.")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Chat or Terminal" })).toHaveCount(0);

    await page.getByRole("button", { name: "Orchestrate" }).click();
    await expect(reply).toHaveText("/contr:orchestrate ");
    await reply.fill("/contr:orchestrate Review the release with a Codex worker.");
    await reply.press("Enter");
    const approval = page.getByRole("button", { name: /allow/i });
    await expect(approval).toBeVisible();
    await expect(projects.getByRole("button", { name: /Code review/ })).toBeVisible();
    await expect(page.getByText("Second line from worker.")).toHaveCount(0);
    const { address, params } = JSON.parse(readFileSync(log, "utf8").trim());
    expect(params).toMatchObject({ labels: { "contr.codex.thread": "test-thread" }, no_parent: true, cwd });
    const workers = JSON.parse(readFileSync(orchList, "utf8"));
    expect(workers[0]).toMatchObject({ parent: address, agent: "codex" });

    await approval.click();
    await expect(page.getByText("Second line from worker.")).toBeVisible();
    await expect(page.getByText("Coordinator received the worker report.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Release coordinator", selected: true })).toBeVisible();
    await expect(page.getByLabel("Status").getByText("Orchestrating · 1 worker")).toBeVisible({ timeout: 15_000 });
    for (const [width, height] of [[640, 480], [1400, 900]]) {
      await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w, h), [width, height]);
      await page.screenshot({ path: path.resolve(import.meta.dirname, "../../../tmp/shots", `330-codex-orchestration-${width}.png`) });
    }
  } finally {
    await app.close();
  }

  const { params } = JSON.parse(readFileSync(log, "utf8").trim());
  writeFileSync(path.join(params.argv[2], "002.report"), "code-review: done, report while contr was closed.");
  const reopened = await launchApp(env, cwd);
  try {
    const page = await reopened.firstWindow();
    await expect(page.getByRole("tab", { name: "Release coordinator", selected: true })).toBeVisible();
    await expect(page.getByText("code-review: done, report while contr was closed.")).toBeVisible();
    await expect(page.getByText("Coordinator received the worker report.")).toBeVisible();
  } finally {
    await reopened.close();
  }
});
