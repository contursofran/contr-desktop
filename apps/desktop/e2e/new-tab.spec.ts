import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const project = {
  CONTR_TERMINAL: "t7",
  FAKE_HC_AGENTS: "1",
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
};
const launches = (log: string) => readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { address: string; params: object });

test("the new-tab menu starts an agent in the selected worker's folder and keeps the tab over restart", async () => {
  const info = test.info();
  const data = info.outputPath("profile");
  mkdirSync(data, { recursive: true });
  const log = info.outputPath("hc-run.jsonl");
  const env = { ...project, FAKE_HC_RUN_LOG: log };
  const app = await launchApp(env, data);
  try {
    const page = await app.firstWindow();
    const tabs = page.getByRole("tablist", { name: "Tabs" });
    const worker = "Flow and sequence diagrams";
    await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: new RegExp(worker) }).click();
    await expect(tabs.getByRole("tab", { name: worker })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name: "Claude Code" }).click();
    await expect(tabs.getByRole("tab").last()).toHaveText("Claude Code");
    await expect(tabs.getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
    const [launch] = launches(log);
    expect(launch.params).toMatchObject({ cwd: "/work/contr-desktop-wt/agent/30", argv: ["claude"], no_parent: true });
    await expect.poll(() => page.evaluate(() => localStorage.getItem("tabs.open"))).toContain(launch.address);
  } finally {
    await app.close();
  }

  const restarted = await launchApp(env, data);
  try {
    const tabs = (await restarted.firstWindow()).getByRole("tablist", { name: "Tabs" });
    await expect(tabs.getByRole("tab").last()).toHaveText("Claude Code");
  } finally {
    await restarted.close();
  }
});

test("Codex streams in Chat and opens the same thread in the terminal", async () => {
  const log = test.info().outputPath("hc-run.jsonl");
  const data = test.info().outputPath("profile");
  mkdirSync(path.dirname(log), { recursive: true });
  mkdirSync(data, { recursive: true });
  const env = { ...project, FAKE_HC_RUN_LOG: log, FAKE_HC_CONNECT: "1" };
  const app = await launchApp(env, data);
  try {
    const page = await app.firstWindow();
    await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "Chat panel usability audit" }).waitFor();
    await page.evaluate(() => window.contr.setTheme("light"));
    await page.getByRole("button", { name: /Inbox/ }).click();
    await expect(page.getByRole("tab", { selected: true })).toHaveCount(0);
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name: "Codex" }).click();
    await expect(page.getByRole("tab", { name: "Codex", selected: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Chat" })).toBeChecked();
    await page.getByRole("radio", { name: "Terminal" }).click();
    await expect(page.getByText("Send a message in Chat before opening the Codex terminal.")).toBeVisible();
    await page.getByRole("radio", { name: "Chat" }).click();
    const reply = page.getByRole("textbox", { name: "Reply to Codex" });
    await reply.fill("Show the workspace");
    await reply.press("Enter");
    await expect(page.getByText("Streaming from Codex.")).toBeVisible();
    await page.getByRole("button", { name: /allow/i }).click();
    await expect(page.getByText("Codex finished.")).toBeVisible();
    await expect(page.getByText("Streaming from Codex.")).toHaveCount(0);
    await page.screenshot({ path: path.join(shots, "codex-app-server.png") });
    await page.getByRole("radio", { name: "Terminal" }).click();
    await expect(page.locator(".xterm-rows").getByText(/fake terminal/)).toBeVisible();
    expect(launches(log).map((launch) => launch.params)).toEqual([{
      cwd: "/work/contr-desktop",
      argv: [path.join(e2e, "fake-codex.mjs"), "resume", "--remote", expect.stringMatching(/^unix:/), "test-thread"],
      no_parent: true,
      display: { bg: "#eff0f2", fg: "#2c2c2d", cursor: "#1e1e1e" },
    }]);
    await page.getByRole("radio", { name: "Chat" }).click();
    await expect(page.getByText("Codex finished.")).toBeVisible();
  } finally {
    await app.close();
  }

  const restarted = await launchApp(env, data);
  try {
    const page = await restarted.firstWindow();
    await expect(page.getByRole("tab", { name: "Codex", selected: true })).toBeVisible();
    await expect(page.getByText("Codex finished.")).toBeVisible();
  } finally {
    await restarted.close();
  }
});

test("Shell starts in the home folder without a project and shows the terminal", async () => {
  const log = test.info().outputPath("hc-run.jsonl");
  mkdirSync(path.dirname(log), { recursive: true });
  const app = await launchApp({ CONTR_TERMINAL: "", FAKE_HC_RUN_LOG: log, FAKE_HC_CONNECT: "1" });
  try {
    const page = await app.firstWindow();
    const newTab = page.getByRole("button", { name: "New tab" });
    await newTab.waitFor();
    await page.evaluate(() => window.contr.setTheme("dark"));
    await newTab.click();
    await page.getByRole("menuitem", { name: "Shell" }).click();
    await expect(page.getByRole("tab", { name: "Shell", selected: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Terminal" })).toBeChecked();
    expect(launches(log).map((launch) => launch.params)).toEqual([{
      cwd: homedir(), argv: [], no_parent: true,
      display: { bg: "#141518", fg: "#d5d5d5", cursor: "#e9e9ea" },
    }]);
    await expect(page.locator(".xterm-rows").getByText(/fake terminal t-new-shell-/)).toBeVisible();
    await page.screenshot({ path: path.join(shots, "262-new-tab-shell.png") });
  } finally {
    await app.close();
  }
});

test("the launch IPC returns the hc error message", async () => {
  const app = await launchApp({ ...project, FAKE_HC_RUN_ERROR: "fake hc: cannot start program" });
  try {
    const page = await app.firstWindow();
    expect(await page.evaluate(() => window.contr.terminal.start?.("shell", null)))
      .toEqual({ error: "fake hc: cannot start program" });
  } finally {
    await app.close();
  }
});
