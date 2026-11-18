import { expect, test } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

// docs/design/redesign/screens.html `.status` and chat-screen.html `.rf` and `.seg` (#230, #221).
// Chromium keeps alpha in 8 bits, so 0.586 reads 0.584.
const INK = {
  dark: { bright: "rgb(244, 244, 245)", dim: "rgba(255, 255, 255, 0.5)" },
  light: { bright: "rgb(20, 20, 20)", dim: "rgba(0, 0, 0, 0.584)" },
};

function launch(env: Record<string, string> = {}) {
  return launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HC_CWD: os.tmpdir(),
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
    FAKE_GIT_BRANCH: "main",
    ...env,
  });
}

test("the status line, the model button and the switch are as the mock", async () => {
  test.setTimeout(60_000);
  const app = await launch();
  const page = await app.firstWindow();
  const status = page.getByLabel("Status");
  await expect(status).toContainText("Hashing…35s · ↓ 1.2k tokens");
  const detail = status.getByText("35s · ↓ 1.2k tokens");
  const model = page.getByRole("button", { name: "Model" });
  await expect(model).toHaveText("Opus 5.5medium");
  // The mock's `.rf` has no chevron after the effort: the agent icon is the one picture.
  await expect(model.locator("svg")).toHaveCount(1);
  await expect(model.locator("[data-icon]")).toHaveCount(1);
  await expect(page.getByLabel("Branch")).toHaveText("main");

  await expect(status).toHaveCSS("font-size", "12px");
  await expect(status).toHaveCSS("column-gap", "10px");
  await expect(status).toHaveCSS("padding-left", "4px");
  await expect(status).toHaveCSS("padding-right", "4px");
  await expect(detail).toHaveCSS("font-size", "11px");
  await expect(status.getByText("Orchestrating · 3 workers")).toHaveCSS("font-size", "12px");

  // `.seg`: 52 px under the top of the work area, 14 px from its right, 28 px high.
  const seg = page.getByRole("group", { name: "Chat or Terminal" });
  const main = await page.locator("main").boundingBox();
  const box = await seg.boundingBox();
  expect(box!.y - main!.y).toBe(52);
  expect(main!.x + main!.width - (box!.x + box!.width)).toBe(14);
  expect(box!.height).toBe(28);

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // The mock's mono is `--ink-38`; it keeps `dim` (ink-50), which reaches 4.5:1 in light (decision 198).
    await expect(status.getByText("Hashing…")).toHaveCSS("color", INK[scheme].dim);
    await expect(detail).toHaveCSS("color", INK[scheme].dim);
    await expect(status.getByText("Orchestrating · 3 workers")).toHaveCSS("color", INK[scheme].dim);
    await page.screenshot({ path: path.join(shots, `status-reply-${scheme}.png`) });
    await page.locator("main").screenshot({ path: path.join(shots, `status-reply-main-${scheme}.png`) });
  }
  await app.close();
});

test("the context at 80% or more is bright ink, and a failed send is bright ink: red is only 'needs you'", async () => {
  test.setTimeout(60_000);
  const app = await launch({ FAKE_HELPER_CONTEXT: "85", FAKE_HELPER_SEND_ERROR: "no_terminal" });
  const page = await app.firstWindow();
  const context = page.getByLabel("Context 85%");
  await expect(context).toHaveText("85%");
  const box = page.getByRole("textbox", { name: /Reply/ });
  await box.fill("one");
  await box.press("Enter");
  const alert = page.getByRole("form", { name: "Reply" }).getByRole("alert");
  await expect(alert).toHaveText("Not sent: fake send error no_terminal");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(context).toHaveCSS("color", INK[scheme].bright);
    await expect(alert).toHaveCSS("color", INK[scheme].bright);
    await page.getByRole("form", { name: "Reply" }).screenshot({ path: path.join(shots, `reply-context-warn-${scheme}.png`) });
  }
  await app.close();
});
