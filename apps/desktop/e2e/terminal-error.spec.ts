import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// hc errors with the fake hc only: FAKE_HC_DOWN makes it fail while its file is there, FAKE_HC_CONNECT=1 lets `connect` attach.
const e2e = import.meta.dirname;

function hcDown() {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-hc-")), "down");
  writeFileSync(file, "");
  return file;
}

const env = (down: string) => ({
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  FAKE_HC_CONNECT: "1",
  FAKE_HC_DOWN: down,
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
});

test("Retry reattaches to hc and receives terminal data after an outage", async () => {
  const down = hcDown();
  const app = await launchApp(env(down));
  const page = await app.firstWindow();
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect(note.locator("p")).toHaveText("The connection to hc ended.");
  await expect(note.locator("pre")).toHaveText("hc closed the connection: fake hc: the core is not running");
  rmSync(down);
  await note.getByRole("button", { name: "Retry" }).click();
  await expect(note).toBeHidden();
  const term = page.getByTestId("terminal");
  await expect(term).toContainText("fake terminal t7 attached");
  await app.close();
});

test("main handles a bad hc hello without an uncaught error", async () => {
  const app = await launchApp({ ...env(""), FAKE_HC_CONNECT: "bad-hello" });
  const errors: string[] = [];
  app.process().stderr?.on("data", (d: Buffer) => errors.push(d.toString()));
  const page = await app.firstWindow();
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect(note.locator("p")).toHaveText("hc sent data that contr cannot read.");
  await expect(note.locator("pre")).toHaveText("hc sent data that is not JSON");
  expect(errors.join("")).not.toMatch(/Uncaught|SyntaxError/);
  await app.close();
});

test("Retry after an hc outage reads the project list again", async () => {
  const down = hcDown();
  const app = await launchApp({ ...env(down), CONTR_TERMINAL: "" });
  const page = await app.firstWindow();
  const note = page.getByRole("alert", { name: "hc error" });
  const projects = page.getByRole("navigation", { name: "Projects" });
  await expect(note.locator("p")).toHaveText("hc is not reachable.");
  await expect(note.locator("pre")).toHaveText("fake hc: the core is not running");

  rmSync(down);
  await note.getByRole("button", { name: "Retry" }).click();
  // Sooner than the 10 s poll: Retry made the read.
  await expect(projects.getByRole("region", { name: "contr-desktop" })).toBeVisible({ timeout: 4000 });
  await expect(note).toBeHidden();
  await app.close();
});
