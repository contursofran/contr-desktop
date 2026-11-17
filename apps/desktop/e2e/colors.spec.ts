import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

// The values of herdr-contr-mac.json (dark) and herdr-contr-mac-light.json (light).
const THEME = {
  dark: { chrome: "rgb(28, 28, 28)", canvas: "rgb(32, 32, 32)", foreground: "rgb(222, 222, 222)", working: "rgb(10, 132, 255)", done: "rgb(48, 209, 88)", blocked: "rgb(255, 159, 10)" },
  light: { chrome: "rgb(245, 245, 245)", canvas: "rgb(236, 236, 236)", foreground: "rgb(29, 29, 31)", working: "rgb(0, 122, 255)", done: "rgb(52, 199, 89)", blocked: "rgb(255, 149, 0)" },
};

test("the palette, the agent icons and the loader are herdr-contr's", async () => {
  test.setTimeout(60_000);
  // t9 waits for the owner: a blocked agent next to the done t11.
  const status = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-")), "status.json");
  writeFileSync(status, JSON.stringify({ t9: "blocked" }));
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    FAKE_HC_STATUS: status,
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  });
  const page = await app.firstWindow();
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  const tab = (name: string) => tabs.getByRole("tab", { name }).locator("..");

  // Claude Code and Codex are pictures in their own colors (Herdr's programs.json: `tint: false`), not tinted by state.
  const audit = nav.getByRole("button", { name: /Chat panel usability audit/ });
  await expect(audit.locator('[data-icon="claude-code"] path')).toHaveAttribute("fill", "#D97757");
  await expect(nav.locator('[data-icon="codex"] path').first()).toHaveAttribute("fill", "#fff");
  await expect(tab("Chat panel usability audit").locator('[data-icon="claude-code"] path')).toHaveAttribute("fill", "#D97757");
  // An agent with no program picture keeps a one-color glyph in its state's color.
  await expect(nav.getByRole("button", { name: /Virtual list/ }).locator('[data-icon="agent"]')).toHaveCount(1);

  // The loader: the braille frames, in `working` on a tab and in `foreground` in the sidebar (herdr-contr-spaces `mark()`).
  const tabLoader = tab("Chat panel usability audit").getByRole("status");
  await expect(tabLoader).toHaveText(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]$/);
  await expect(tabLoader).toHaveCSS("font-size", "12px");
  const sideLoader = audit.getByRole("status");
  await expect(sideLoader).toHaveCSS("width", "15px");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = THEME[scheme];
    expect(await nav.evaluate((e) => getComputedStyle(e.closest("aside")!).backgroundColor)).toBe(t.chrome);
    expect(await tabs.evaluate((e) => getComputedStyle(e.parentElement!).backgroundColor)).toBe(t.chrome);
    expect(await page.locator("main").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(t.canvas);
    expect(await tabLoader.evaluate((e) => getComputedStyle(e).color)).toBe(t.working);
    expect(await sideLoader.evaluate((e) => getComputedStyle(e).color)).toBe(t.foreground);
    expect(await page.getByLabel("Status").getByRole("status").evaluate((e) => getComputedStyle(e).color)).toBe(t.foreground);
    await page.screenshot({ path: path.join(shots, `colors-working-${scheme}.png`) });
  }

  // A done and a blocked agent: a 6 px dot in `done` or `blocked` on its tab.
  await nav.getByRole("button", { name: /Release notes draft/ }).click();
  await nav.getByRole("button", { name: /Cards for prompts and questions/ }).click();
  const done = tab("Release notes draft").locator('[data-state="done"]');
  const blocked = tab("Cards for prompts and questions").locator('[data-state="blocked"]');
  await expect(done).toHaveCSS("width", "6px");
  await expect(tab("Release notes draft").getByRole("status")).toHaveCount(0);
  // The screenshots show b-40's own chat: wait for its model and its permission card (#90).
  await expect(page.getByRole("button", { name: "Model" })).toHaveText("Opus 5.5high");
  await expect(page.getByRole("region", { name: "Approval" })).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await done.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(THEME[scheme].done);
    expect(await blocked.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(THEME[scheme].blocked);
    await page.screenshot({ path: path.join(shots, `colors-done-blocked-${scheme}.png`) });
  }
  await app.close();
});
