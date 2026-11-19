import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const image = path.join(e2e, "fixtures/shot.png");

function launch(sendLog: string, picked = image) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HELPER_SEND_LOG: sendLog,
    FAKE_HELPER_PASTE_IMAGE: image,
    // CONTR_E2E=1 (launch.ts): main takes this path and opens no dialog.
    CONTR_E2E_PICK_IMAGE: picked,
  });
}

const sent = (log: string) => existsSync(log) ? JSON.parse(readFileSync(log, "utf8")) : null;

test("the picked image loads through the local image protocol and is sent through the helper", async () => {
  test.setTimeout(60_000);
  const sendLog = test.info().outputPath("send.jsonl");
  const app = await launch(sendLog);
  try {
    const page = await app.firstWindow();
    const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
    await page.getByRole("button", { name: "Attach image" }).click();
    const picture = page.getByRole("list", { name: "Attachments" }).getByRole("img", { name: "shot.png" });
    await expect.poll(() => picture.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    await box.fill("look");
    await box.press("Enter");
    await expect.poll(() => sent(sendLog)).toEqual({ terminal: "t7", text: `look\n${image}` });
  } finally {
    await app.close();
  }
});

test("paste and pick IPC send both paths even when a picked file is missing", async () => {
  test.setTimeout(60_000);
  const sendLog = test.info().outputPath("send.jsonl");
  // A PNG path with no file behind it: the picker gives it, and the picture cannot load.
  const gone = test.info().outputPath("gone.png");
  const app = await launch(sendLog, gone);
  try {
    const page = await app.firstWindow();
    const box = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
    const items = page.getByRole("list", { name: "Attachments" }).getByRole("listitem");
    await box.evaluate((el) => {
      const data = new DataTransfer();
      data.items.add(new File(["x"], "x.png", { type: "image/png" }));
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    const picture = items.getByRole("img", { name: "shot.png" });
    await expect.poll(() => picture.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);

    await page.getByRole("button", { name: "Attach image" }).click();
    await expect(items.nth(1)).toHaveText("gone.png");
    await expect(items.nth(1)).toHaveAttribute("title", gone);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => sent(sendLog)).toEqual({ terminal: "t7", text: `${image}\n${gone}` });
  } finally {
    await app.close();
  }
});
