import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const image = path.resolve(import.meta.dirname, "fixtures/shot.png");

test("the + button attaches the picked image and sends its path", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_TITLE: "Chat panel usability audit",
    FAKE_HELPER_SEND_LOG: sendLog,
    // CONTR_E2E=1 (launch.ts): main takes this path and opens no dialog.
    CONTR_E2E_PICK_IMAGE: image,
  });
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  await page.getByRole("button", { name: "Attach image" }).click();
  await expect(page.getByRole("list", { name: "Attachments" })).toHaveText("shot.png");
  await box.fill("look");
  await box.hover();
  await expect(page.getByRole("button", { name: "Model" })).toContainText("Opus 5.5");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole("form", { name: "Reply" }).screenshot({ path: path.join(shots, `attach-${scheme}.png`) });
  }
  await box.press("Enter");
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({ terminal: "t7", text: `look\n${image}` });
  await app.close();
});
