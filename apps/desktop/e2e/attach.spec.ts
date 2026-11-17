import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const image = path.resolve(import.meta.dirname, "fixtures/shot.png");
// A file that is not a picture: the fake helper answers a paste with this path.
const notes = path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl");

function launch(sendLog: string) {
  return launchApp({
    CONTR_HELPER: path.resolve(import.meta.dirname, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.resolve(import.meta.dirname, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HELPER_SEND_LOG: sendLog,
    FAKE_HELPER_PASTE_IMAGE: notes,
    // CONTR_E2E=1 (launch.ts): main takes this path and opens no dialog.
    CONTR_E2E_PICK_IMAGE: image,
  });
}

test("the + button attaches the picked image as a picture with a × and sends its path", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(sendLog);
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  const attachments = page.getByRole("list", { name: "Attachments" });
  await page.getByRole("button", { name: "Attach image" }).click();
  // A 56 px high picture with 8 px corners and a `border` frame, loaded from the file.
  const picture = attachments.getByRole("img", { name: "shot.png" });
  await expect(picture).toHaveCSS("height", "56px");
  await expect(picture).toHaveCSS("border-top-left-radius", "8px");
  await expect(picture).toHaveCSS("border-top-width", "1px");
  await expect.poll(() => picture.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  await expect(attachments.getByRole("button", { name: "Remove shot.png" })).toBeVisible();
  await box.fill("look");
  await box.hover();
  await expect(page.getByRole("button", { name: "Model" })).toContainText("Opus 5.5");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole("form", { name: "Reply" }).screenshot({ path: path.join(shots, `attach-${scheme}.png`) });
  }
  await box.press("Enter");
  await expect(box).toHaveValue("");
  await expect(attachments).toHaveCount(0);
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({ terminal: "t7", text: `look\n${image}` });
  await app.close();
});

test("the × removes one attachment with Enter or Space, files stay with their agent, and only the rest is sent", async () => {
  test.setTimeout(60_000);
  const sendLog = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "send.jsonl");
  const app = await launch(sendLog);
  const page = await app.firstWindow();
  const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  const attachments = page.getByRole("list", { name: "Attachments" });
  const items = attachments.getByRole("listitem");
  const attach = page.getByRole("button", { name: "Attach image" });
  await attach.click();
  await expect(items).toHaveCount(1);
  await attach.click();
  await expect(items).toHaveCount(2);
  // A pasted file that is not a picture is a chip with its name and the same ×.
  await box.evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(["x"], "x.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(items).toHaveCount(3);
  await expect(items.nth(2)).toHaveText("claude-session.jsonl");
  await expect(items.nth(2).getByRole("button", { name: "Remove claude-session.jsonl" })).toBeVisible();
  await expect(attachments.getByRole("img", { name: "shot.png" })).toHaveCount(2);
  await box.fill("two files");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole("form", { name: "Reply" }).screenshot({ path: path.join(shots, `attach-three-${scheme}.png`) });
  }

  // Another agent has its own empty draft; back on this one, the files are there.
  const nav = page.getByRole("navigation", { name: "Projects" });
  await nav.getByRole("button", { name: /Release notes draft/ }).click();
  await expect(page.getByRole("textbox", { name: "Reply to Release notes draft" })).toHaveValue("");
  await expect(attachments).toHaveCount(0);
  await nav.getByRole("button", { name: /Chat panel usability audit/ }).click();
  await expect(items).toHaveCount(3);

  // The × buttons are Tab stops before the text box. Enter on one, then Space on another, removes each.
  await box.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Remove claude-session.jsonl" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const first = attachments.getByRole("button", { name: "Remove shot.png" }).first();
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(items).toHaveCount(2);
  await expect(box).toBeFocused();
  await expect(box).toHaveValue("two files");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Remove claude-session.jsonl" })).toBeFocused();
  await page.keyboard.press(" ");
  await expect(items).toHaveCount(1);
  await expect(box).toHaveValue("two files");

  await page.getByRole("button", { name: "Send" }).click();
  await expect(box).toHaveValue("");
  expect(JSON.parse(readFileSync(sendLog, "utf8"))).toEqual({ terminal: "t7", text: `two files\n${image}` });
  await app.close();
});
