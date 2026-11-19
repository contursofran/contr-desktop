import { expect, test } from "@playwright/test";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

async function open(env: Record<string, string> = {}) {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "open.json");
  copyFileSync(path.join(e2e, "fixtures/owner/open.json"), file);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_TERMINAL: "t7",
    FAKE_ORCH_OWNER: file,
    ...env,
  });
  const page = await app.firstWindow();
  const runs = () => readFileSync(`${file}.log`, "utf8").trim().split("\n");
  return { app, page, runs };
}

test("the owner answers a question and marks a to-do done; the next items show", async () => {
  test.setTimeout(60_000);
  const { app, page, runs } = await open();
  const q = page.getByRole("region", { name: "Owner question" });
  const t = page.getByRole("region", { name: "Owner to-do" });
  await q.getByRole("radio", { name: "Oldest first · recommended", exact: true }).click();
  await expect(q).toContainText("D8 · The coordinator asks");
  await q.getByRole("textbox", { name: "Own answer" }).fill("2");
  await q.getByRole("button", { name: "Send answer" }).click();
  await expect(q).toHaveCount(0);
  await t.getByRole("button", { name: "Done" }).click();
  await expect(t).toContainText("T4The CI cache is now keyed on the lockfile.To know · from b-16");
  expect(runs()).toEqual(["answer D7 Oldest first", "answer D8 2", "done T3"]);
  await app.close();
});

test("a failed run keeps the card with the tool's message", async () => {
  test.setTimeout(60_000);
  const { app, page } = await open({ FAKE_ORCH_OWNER_FAIL: "1" });
  const q = page.getByRole("region", { name: "Owner question" });
  await q.getByRole("textbox", { name: "Own answer" }).fill("Both");
  await q.getByRole("button", { name: "Send answer" }).click();
  await expect(q.getByRole("alert")).toHaveText("owner answer: the owner file is locked");
  await expect(q).toContainText("D7 · The coordinator asks");
  const t = page.getByRole("region", { name: "Owner to-do" });
  await t.getByRole("button", { name: "Done" }).click();
  await expect(t.getByRole("alert")).toHaveText("owner done: the owner file is locked");
  await app.close();
});

test("saved, coordinator not reached shows the note alone", async () => {
  test.setTimeout(60_000);
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "one.json");
  copyFileSync(path.join(e2e, "fixtures/owner/open.json"), file);
  const one = JSON.parse(readFileSync(file, "utf8")).filter((i: { id: string }) => i.id === "D7");
  writeFileSync(file, JSON.stringify(one));
  const { app, page } = await open({ FAKE_ORCH_OWNER: file, FAKE_ORCH_OWNER_UNREACHED: "1" });
  const q = page.getByRole("region", { name: "Owner question" });
  await q.getByRole("radio", { name: "Oldest first · recommended", exact: true }).click();
  await expect(q).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "The answer is saved, but the coordinator did not get it: coordinator not reached: D7" })).toBeVisible();
  await app.close();
});
