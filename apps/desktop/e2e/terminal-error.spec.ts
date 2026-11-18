import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// hc errors with the fake hc only: FAKE_HC_DOWN makes it fail while its file is there, FAKE_HC_CONNECT=1 lets `connect` attach.
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

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

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

test("a terminal that cannot attach shows what failed and hc's words, and Retry attaches when hc is back", async () => {
  const down = hcDown();
  const app = await launchApp(env(down));
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect(note.locator("p")).toHaveText("The connection to hc ended.");
  await expect(note.locator("pre")).toHaveText("hc closed the connection: fake hc: the core is not running");
  // The redesign's note: no box; the text in ink, the reason in mono and dim, Retry with a thin line.
  await expect(note).toHaveCSS("border-top-width", "0px");
  await expect(note).toHaveCSS("max-width", "520px");
  await expect(note.locator("pre")).toHaveCSS("font-family", /JetBrains Mono/);
  await expect(note.locator("pre")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const looks = [
    { scheme: "dark", text: "rgb(244, 244, 245)", reason: "rgba(255, 255, 255, 0.5)" },
    { scheme: "light", text: "rgb(20, 20, 20)", reason: "rgba(0, 0, 0, 0.584)" },
  ] as const;
  for (const l of looks) {
    await page.emulateMedia({ colorScheme: l.scheme });
    await expect(note.locator("p")).toHaveCSS("color", l.text);
    await expect(note.locator("pre")).toHaveCSS("color", l.reason);
  }
  await shoot(page, "terminal-error");

  rmSync(down);
  await note.getByRole("button", { name: "Retry" }).click();
  await expect(note).toBeHidden();
  const term = page.getByTestId("terminal");
  await expect(term).toContainText("fake terminal t7 attached");
  // No frame: the terminal fills the area under the tab bar, in JetBrains Mono 13/20.
  await expect(term.locator("..")).toHaveCSS("padding", "16px 24px 18px");
  await expect(term.locator(".xterm-rows")).toHaveCSS("font-family", /JetBrains Mono/);
  await expect(term.locator(".xterm-rows")).toHaveCSS("font-size", "13px");
  await expect(term.locator(".xterm-rows > div").first()).toHaveCSS("height", "20px");
  await shoot(page, "terminal-attached");
  await app.close();
});

test("a hello line from hc that is not JSON shows a plain note, not an error in the main process", async () => {
  const app = await launchApp({ ...env(""), FAKE_HC_CONNECT: "bad-hello" });
  const errors: string[] = [];
  app.process().stderr?.on("data", (d: Buffer) => errors.push(d.toString()));
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect(note.locator("p")).toHaveText("hc sent data that contr cannot read.");
  await expect(note.locator("pre")).toHaveText("hc sent data that is not JSON");
  expect(errors.join("")).not.toMatch(/Uncaught|SyntaxError/);
  await shoot(page, "terminal-not-json");
  await app.close();
});

test("with hc down the main area and the sidebar say hc is not reachable, and Retry reads the list again", async () => {
  const down = hcDown();
  const app = await launchApp({ ...env(down), CONTR_TERMINAL: "" });
  const page = await app.firstWindow();
  const note = page.getByRole("alert", { name: "hc error" });
  const projects = page.getByRole("navigation", { name: "Projects" });
  await expect(note.locator("p")).toHaveText("hc is not reachable.");
  await expect(note.locator("pre")).toHaveText("fake hc: the core is not running");
  await expect(projects.getByText("hc is not reachable", { exact: true })).toBeVisible();
  await shoot(page, "hc-down");

  rmSync(down);
  await note.getByRole("button", { name: "Retry" }).click();
  // Sooner than the 10 s poll: Retry made the read.
  await expect(projects.getByRole("region", { name: "contr-desktop" })).toBeVisible({ timeout: 4000 });
  await expect(note).toBeHidden();
  await app.close();
});
