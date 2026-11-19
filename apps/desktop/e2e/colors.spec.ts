import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

// The contr design-system tokens (src/renderer/tokens.css, #178): opaque fills, ink for text and state, red for "needs you".
const THEME = {
  dark: { chrome: "rgb(17, 18, 20)", canvas: "rgb(20, 21, 24)", foreground: "rgb(233, 233, 234)", working: "rgb(244, 244, 245)", done: "rgba(255, 255, 255, 0.62)", blocked: "rgb(240, 113, 120)" },
  light: { chrome: "rgb(247, 248, 249)", canvas: "rgb(239, 240, 242)", foreground: "rgb(30, 30, 30)", working: "rgb(20, 20, 20)", done: "rgba(0, 0, 0, 0.68)", blocked: "rgb(199, 57, 71)" },
};
// Chromium keeps alpha in 8 bits, so 0.586 reads 0.584. Text in `muted` (ink-62) and `dim` (ink-50), marks and inert controls in `faint` (ink-30). In light both texts reach 4.5:1.
const QUIET = {
  dark: { muted: "rgba(255, 255, 255, 0.62)", dim: "rgba(255, 255, 255, 0.5)", faint: "rgba(255, 255, 255, 0.3)" },
  light: { muted: "rgba(0, 0, 0, 0.68)", dim: "rgba(0, 0, 0, 0.584)", faint: "rgba(0, 0, 0, 0.39)" },
};

test("the palette is the design-system tokens; the agent icons and the loader are herdr-contr's", async () => {
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

  // The status glyph in `working` on a tab (#180) and on a sidebar row (#179).
  const tabLoader = tab("Chat panel usability audit").getByRole("img", { name: "Working" });
  await expect(tabLoader).toHaveAttribute("data-state", "working");
  // The tab's glyph is the mock's `.tab .g` (screens.html, #228): 12 px in a 10 px box; the sidebar's stays 15 px in 14.
  await expect(tabLoader).toHaveCSS("width", "10px");
  await expect(tabLoader).toHaveCSS("font-size", "12px");
  const sideLoader = audit.getByRole("img", { name: "Working" });
  await expect(sideLoader).toHaveAttribute("data-state", "working");
  await expect(sideLoader).toHaveCSS("width", "14px");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const t = THEME[scheme];
    expect(await nav.evaluate((e) => getComputedStyle(e.closest("aside")!).backgroundColor)).toBe(t.chrome);
    expect(await tabs.evaluate((e) => getComputedStyle(e.closest('[data-slot="tabs"]')!).backgroundColor)).toBe(t.canvas);
    expect(await page.locator("main").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(t.canvas);
    expect(await tabLoader.evaluate((e) => getComputedStyle(e).color)).toBe(t.working);
    expect(await sideLoader.evaluate((e) => getComputedStyle(e).color)).toBe(t.working);
    // The status line's glyph is in `working` (ink-100), as the redesign's `.g` glyph (#181).
    expect(await page.getByLabel("Status").getByRole("status").evaluate((e) => getComputedStyle(e).color)).toBe(t.working);
    await expect(page.getByText(/Worked 1m 0s/)).toHaveCSS("color", QUIET[scheme].dim);
    await expect(tabs.locator("[data-tab-close]").first()).toHaveCSS("color", QUIET[scheme].dim);
    await expect(page.getByRole("button", { name: "New tab" })).toHaveCSS("color", QUIET[scheme].dim);
    await expect(page.locator("aside > header").getByRole("button", { name: "Search" })).toHaveCSS("color", QUIET[scheme].faint);
    await expect(page.locator("aside > footer").getByRole("button", { name: "Add machine" })).toHaveCSS("color", QUIET[scheme].faint);
    await expect(page.getByRole("listitem", { name: "Claude" }).getByText("Claude", { exact: true })).toHaveCSS("color", QUIET[scheme].dim);
    // The empty box's Send is `dim` (ink-50) on `--hover-strong`, as the redesign's `.send` (#181).
    await expect(page.getByRole("form", { name: "Reply" }).getByRole("button", { name: "Send" })).toHaveCSS("color", QUIET[scheme].dim);
    await expect(page.getByRole("meter", { name: "Claude usage" }).locator("span")).toHaveCSS("background-color", scheme === "dark" ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.5)");
    await page.screenshot({ path: path.join(shots, `colors-working-${scheme}.png`) });
  }

  // A done agent: a 6 px dot in `done` on its tab; a blocked one: the status glyph in red.
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
    expect(await blocked.evaluate((e) => getComputedStyle(e).color)).toBe(THEME[scheme].blocked);
    await page.screenshot({ path: path.join(shots, `colors-done-blocked-${scheme}.png`) });
  }
  await app.close();
});
