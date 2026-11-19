import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import workerTranscript from "../../e2e/fixtures/workers/b-40.jsonl?raw";
import workerCard from "../../e2e/fixtures/workers/b-40-card.json";
import { sidebar } from "../../test/275-sidebar";
import { renderApp } from "../../test/renderApp";
import type { FeedRow } from "../shared/api";

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

const paint = (element: () => Element | null | undefined, property: string) =>
  expect.poll(() => {
    const target = element();
    return target && getComputedStyle(target).getPropertyValue(property);
  });

test("the palette is the design-system tokens; the agent icons and the loader are herdr-contr's", async () => {
  let selected = sidebar.selected;
  const workerRows: FeedRow[] = workerTranscript.trim().split("\n").map((line) => JSON.parse(line));
  const rootRows: FeedRow[] = transcript.trim().split("\n").map((line) => JSON.parse(line));
  await renderApp(transcript, null, {
    sidebar: async () => ({ ...sidebar, selected }),
    select: async (terminal) => { selected = terminal; return selected; },
    onFeed(listener) {
      listener({ type: "splice", at: 0, rows: selected === "t9" ? workerRows : rootRows, agent: "claude", model: "claude-opus-5-5" });
      if (selected === "t7") listener({ type: "working", working: { text: "Hashing…", detail: "35s · ↓ 1.2k tokens" } });
      if (selected === "t9") listener({ type: "card", card: { ...workerCard, kind: "approval", answered: false } });
      return () => {};
    },
    board: async () => ({ workers: {}, roles: {}, agent: selected, checks: {}, orchestrating: selected === "t7" ? 3 : 0 }),
    replyInfo: async () => {
      const percent = selected === "t9" ? 58 : 37;
      return {
        agent: "claude", model: "claude-opus-5-5", effort: selected === "t9" ? "high" : "medium", tier: null, tiers: [], speed: null,
        context: { percent, text: `${percent}%`, warn: false },
        models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "claude-sonnet-5", label: "Sonnet 5" }],
        efforts: ["low", "medium", "high"].map((value) => ({ value, label: value })),
      };
    },
    usage: async () => [
      { plan: "Claude", percent: 64, value: "64% wk · 4d", readAt: Date.now() },
      { plan: "Codex", percent: 21, value: "21% 5h · 3h", readAt: Date.now() },
    ],
  });
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  const tab = async (name: string) => (await tabs.getByRole("tab", { name }).findElement()).parentElement!;
  const audit = nav.getByRole("button", { name: /Chat panel usability audit/ });
  const auditTab = await tab("Chat panel usability audit");

  // Program pictures keep their colors. An agent with no program picture has a one-color glyph.
  await expect.poll(() => audit.query()?.querySelector('[data-icon="claude-code"] path')?.getAttribute("fill")).toBe("#D97757");
  await expect.poll(() => nav.query()?.querySelector('[data-icon="codex"] path')?.getAttribute("fill")).toBe("#fff");
  expect(auditTab.querySelector('[data-icon="claude-code"] path')?.getAttribute("fill")).toBe("#D97757");
  const virtual = nav.getByRole("button", { name: /Virtual list/ });
  expect((await virtual.findElement()).querySelectorAll('[data-icon="agent"]')).toHaveLength(1);

  // The tab glyph is 12 px in a 10 px box (#228). The sidebar glyph stays in a 14 px box.
  const tabLoader = auditTab.querySelector('[role="img"][aria-label="Working"]');
  const sideLoader = audit.getByRole("img", { name: "Working" });
  expect(tabLoader?.getAttribute("data-state")).toBe("working");
  await paint(() => tabLoader, "width").toBe("10px");
  await paint(() => tabLoader, "font-size").toBe("12px");
  await expect.element(sideLoader).toHaveAttribute("data-state", "working");
  await paint(() => sideLoader.query(), "width").toBe("14px");

  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    const t = THEME[scheme];
    await paint(() => nav.query()?.closest("aside"), "background-color").toBe(t.chrome);
    await paint(() => tabs.query()?.closest('[data-slot="tabs"]'), "background-color").toBe(t.canvas);
    await paint(() => page.getByRole("main").query(), "background-color").toBe(t.canvas);
    await paint(() => tabLoader, "color").toBe(t.working);
    await paint(() => sideLoader.query(), "color").toBe(t.working);
    await paint(() => page.getByLabelText("Status").getByRole("status").query(), "color").toBe(t.working);
    const quiet = QUIET[scheme];
    await paint(() => page.getByText(/Worked 1m 0s/).query(), "color").toBe(quiet.dim);
    await paint(() => page.getByRole("button", { name: "Close Chat panel usability audit" }).query(), "color").toBe(quiet.dim);
    await paint(() => page.getByRole("button", { name: "New tab" }).query(), "color").toBe(quiet.dim);
    await paint(() => page.getByRole("button", { name: "Search" }).query(), "color").toBe(quiet.faint);
    await paint(() => page.getByRole("button", { name: "Add machine" }).query(), "color").toBe(quiet.faint);
    const claude = page.getByRole("listitem", { name: "Claude" }).getByText("Claude", { exact: true });
    await paint(() => claude.query(), "color").toBe(quiet.dim);
    const send = page.getByRole("form", { name: "Reply" }).getByRole("button", { name: "Send" });
    await paint(() => send.query(), "color").toBe(quiet.dim);
    const meter = page.getByRole("meter", { name: "Claude usage" });
    await paint(() => meter.query()?.querySelector("span"), "background-color")
      .toBe(scheme === "dark" ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.5)");
    await page.screenshot({ path: `../../../../tmp/shots/browser/colors-working-${scheme}.png` });
  }

  await nav.getByRole("button", { name: /Release notes draft/ }).click();
  await nav.getByRole("button", { name: /Cards for prompts and questions/ }).click();
  const doneTab = await tab("Release notes draft");
  const blockedTab = await tab("Cards for prompts and questions");
  await paint(() => doneTab.querySelector('[data-state="done"]'), "width").toBe("6px");
  expect(doneTab.querySelectorAll('[role="status"]')).toHaveLength(0);
  // Wait for b-40's model and permission card before taking the screenshots.
  await expect.element(page.getByRole("button", { name: "Model" })).toHaveTextContent("Opus 5.5high");
  await expect.element(page.getByRole("region", { name: "Approval" })).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await paint(() => doneTab.querySelector('[data-state="done"]'), "background-color").toBe(THEME[scheme].done);
    await paint(() => blockedTab.querySelector('[data-state="blocked"]'), "color").toBe(THEME[scheme].blocked);
    await page.screenshot({ path: `../../../../tmp/shots/browser/colors-done-blocked-${scheme}.png` });
  }
});
