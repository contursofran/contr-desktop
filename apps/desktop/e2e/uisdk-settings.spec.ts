import { expect, test } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const env = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_TITLE: "Chat panel usability audit",
  FAKE_HC_CWD: os.tmpdir(),
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  FAKE_GIT_BRANCH: "agent/75-uisdk-settings",
};

test("the theme control moves with the arrow keys and has one tab stop", async () => {
  test.setTimeout(60_000);
  const app = await launchApp(env, mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-")));
  const page = await app.firstWindow();
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  const theme = page.getByRole("radiogroup", { name: "Theme" });
  const radio = (name: string) => theme.getByRole("radio", { name });
  await expect(radio("System")).toHaveAttribute("aria-checked", "true");
  await radio("System").focus();
  await page.keyboard.press("ArrowRight");
  await expect(radio("Dark")).toBeFocused();
  await expect(radio("Dark")).toHaveAttribute("aria-checked", "true");
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");
  await page.keyboard.press("ArrowRight");
  await expect(radio("Light")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await page.keyboard.press("ArrowLeft");
  await expect(radio("Dark")).toHaveAttribute("aria-checked", "true");
  await expect(theme.locator("[tabindex='0']")).toHaveCount(1);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole("region", { name: "Settings" }).screenshot({ path: path.join(shots, `uisdk-theme-${scheme}.png`) });
  }
  await app.close();
});

test("the reply box and the code block show UI SDK tooltips on hover and focus; Escape closes them", async () => {
  test.setTimeout(60_000);
  const app = await launchApp(env, mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-")));
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const tip = page.getByRole("tooltip");

  const attach = page.getByRole("button", { name: "Attach image" });
  await attach.hover();
  await expect(tip.filter({ visible: true })).toHaveText("Attach image");
  await page.screenshot({ path: path.join(shots, "uisdk-tip-attach-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "uisdk-tip-attach-light.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.mouse.move(0, 0);
  await expect(tip.filter({ visible: true })).toHaveCount(0);

  const ring = page.getByLabel("Context 37%");
  await page.getByRole("button", { name: "Model" }).focus();
  await page.keyboard.press("Tab");
  await expect(ring).toBeFocused();
  const ringTip = tip.filter({ visible: true });
  await expect(ringTip).toHaveCount(1);
  await expect(ringTip).toHaveText("ctx 37%");
  await page.keyboard.press("Escape");
  await expect(tip.filter({ visible: true })).toHaveCount(0);
  await expect(ring).toBeFocused();

  const copy = page.getByRole("button", { name: "Copy code" }).first();
  await copy.scrollIntoViewIfNeeded();
  await copy.hover();
  await expect(tip.filter({ visible: true })).toHaveText("Copy code");
  await page.screenshot({ path: path.join(shots, "uisdk-tip-copy-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "uisdk-tip-copy-light.png") });
  await app.close();
});
