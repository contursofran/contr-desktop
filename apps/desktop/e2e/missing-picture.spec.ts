import { expect, test } from "@playwright/test";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;

test("the local image protocol loads a PNG and fails for missing files and unsupported types", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/missing-picture-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  });
  const page = await app.firstWindow();
  const md = (await chatRow(page, "a1")).locator(".chat-markdown");

  // The local protocol fails for missing files and unsupported types.
  await expect(md.locator("[data-missing-image]")).toHaveCount(3);
  const image = md.getByRole("img", { name: "The login form" });
  await expect(image).toHaveAttribute("src", /^contr-image:\/\/local\//);
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await app.close();
});
