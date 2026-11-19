import { expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import b30 from "../../e2e/fixtures/workers/b-30.jsonl?raw";
import b40 from "../../e2e/fixtures/workers/b-40.jsonl?raw";
import approval from "../../e2e/fixtures/workers/b-40-card.json";
import { color, count, css, rect, replyInfo, rows, selectable, shot, transcript } from "../../test/281-shell";
import { sidebar } from "../../test/275-sidebar";
import { renderApp } from "../../test/renderApp";
import { findAgent } from "./topbar/TopBar";

const countedSidebar = structuredClone(sidebar);
Object.assign(countedSidebar.projects[0]!, { ahead: 2, behind: 4 });

test("the sidebar lists projects, agents and workers, and a click switches the chat", async () => {
  const send = vi.fn(async () => ({ ok: true }));
  await renderApp(transcript, null, { ...selectable(countedSidebar).overrides, send });
  const nav = page.getByRole("navigation", { name: "Projects" });
  const desktop = nav.getByRole("region", { name: "contr-desktop" });
  await expect.poll(() => desktop.getByRole("listitem").elements().length).toBe(5);
  // #45: the project row has its branch, the commits ahead and behind from git, and the folder (the fake folder has no favicon).
  await expect.poll(() => css("[data-branch]", desktop)?.textContent).toBe("main");
  await expect.poll(() => css("[data-ahead]", desktop)?.textContent).toBe("↑2");
  await expect.poll(() => css("[data-behind]", desktop)?.textContent).toBe("↓4");
  await expect.poll(() => count('[data-icon="folder"]', desktop)).toBe(1);
  await expect.poll(() => desktop.getByRole("button", { name: /Chat panel usability audit/ }).query()?.textContent).toMatch(/Orchestrating · 3 workers/);
  await expect.element(desktop.getByRole("button", { name: /Chat panel usability audit/ })).toHaveAttribute("aria-current", "true");
  await expect.poll(() => desktop.getByRole("button", { name: /Flow and sequence diagrams/ }).element().textContent).toContain("b-30");
  const flow = desktop.getByRole("button", { name: /Flow and sequence diagrams/ });
  await expect.element(flow).toHaveAccessibleDescription("b-30 · #30 · Flow and sequence diagrams");
  await expect.poll(() => css("[data-icon]", flow)?.getAttribute("data-icon")).toBe("claude-code");
  await expect.element(desktop.getByRole("button", { name: /Virtual list/ })).toHaveAccessibleDescription("b-50 · Virtual list");
  const notes = desktop.getByRole("button", { name: /Release notes draft/ });
  await expect.poll(() => css("[data-age]", notes)?.textContent).toBe("<1m");
  // #227: a done agent that is not shown is a plain row, as the mock's `.ag`.
  await expect.element(notes).toHaveStyle({ fontWeight: "400" });
  await expect.poll(() => count("[data-age]", desktop.getByRole("button", { name: /Chat panel usability audit/ }))).toBe(0);
  const herdr = nav.getByRole("region", { name: "herdr-contr" });
  await expect.poll(() => herdr.getByRole("listitem").elements().length).toBe(1);
  await expect.poll(() => herdr.getByRole("listitem").element().textContent).toContain("Install health check");
  await expect.poll(() => css("[data-icon]", herdr.getByRole("listitem"))?.getAttribute("data-icon")).toBe("codex");
  await expect.element(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  // #57: the status line counts the same workers as the rows under the agent (t7: three; the 5 rows hold t7, t11 and its 3 workers).
  await expect.poll(() => page.getByLabelText("Status").element().textContent).toContain("Orchestrating · 3 workers");
  await commands.colorScheme("dark");
  await shot("sidebar-dark");
  await commands.colorScheme("light");
  await shot("sidebar-light");

  await herdr.getByRole("button", { name: "Install health check", exact: false }).click();
  await expect.element(herdr.getByRole("button", { name: "Install health check", exact: false })).toHaveAttribute("aria-current", "true");
  await expect.element(notes).toHaveStyle({ fontWeight: "400" });
  // t12 has no worker rows or worker count.
  await expect.poll(() => herdr.getByRole("listitem").elements().length).toBe(1);
  await expect.element(page.getByLabelText("Status")).toBeVisible();
  await expect.poll(() => page.getByLabelText("Status").element().textContent).not.toContain("Orchestrating");
  await commands.colorScheme("dark");
  await shot("worker-count-dark");
  const box = page.getByRole("textbox", { name: "Reply to Install health check" });
  await box.fill("hello");
  await userEvent.keyboard("{Enter}");
  await expect.element(box).toHaveValue("");
  expect(send).toHaveBeenCalledWith("hello");

  // The closed project row shows its agents’ marks.
  await desktop.getByRole("button", { name: "Collapse contr-desktop" }).click();
  await expect.poll(() => desktop.getByRole("listitem").elements().length).toBe(0);
  await expect.poll(() => count("[data-state]", desktop)).toBe(2);
  const name = css("[data-name]", desktop);
  expect(name.textContent).toBe("contr-desktop");
  expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
  // The branch has no room on the shut row: it hides (it is on the hidden second line), not a cut piece.
  const branch = css("[data-branch]", desktop);
  expect(branch.getBoundingClientRect().top).toBeGreaterThanOrEqual(branch.parentElement!.getBoundingClientRect().bottom);
  await commands.colorScheme("dark");
  await shot("project-shut-dark");
  await commands.colorScheme("light");
  await shot("project-shut-light");
  await desktop.getByRole("button", { name: "Expand contr-desktop" }).click();
  await expect.poll(() => desktop.getByRole("listitem").elements().length).toBe(5);
});

test("the sidebar's glyphs, rows and project head are the mock's (#227)", async () => {
  const data = structuredClone(sidebar);
  findAgent(data, "t10")!.state = "idle";
  findAgent(data, "t12")!.state = "idle";
  await renderApp(transcript, null, selectable(data).overrides);
  const nav = page.getByRole("navigation", { name: "Projects" });
  const desktop = nav.getByRole("region", { name: "contr-desktop" });
  const herdr = nav.getByRole("region", { name: "herdr-contr" });
  const notes = desktop.getByRole("button", { name: /Release notes draft/ });
  const dot = notes.getByRole("img", { name: "unread", exact: true });
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    // An idle worker and an idle agent have ⠶ in ink-30; a working one ⠋; a done agent no glyph (#217).
    const idle = desktop.getByRole("button", { name: /Virtual list/ }).getByRole("img", { name: "Idle" });
    await expect.element(idle).toHaveAttribute("aria-label", "Idle");
    await expect.element(idle).toHaveStyle({ "color": color("--ink-30") });
    expect(getComputedStyle(idle.element(), "::before").content).toBe('"⠶"');
    await expect.poll(() => count('[data-state="idle"]', herdr.getByRole("button", { name: /Install health check/ }))).toBe(1);
    await expect.poll(() => count('[data-state="working"]', desktop.getByRole("button", { name: /Flow and sequence diagrams/ }))).toBe(1);
    await expect.poll(() => count("[data-state]", notes)).toBe(0);
    // The unread dot uses the 14 px glyph slot (#246).
    await expect.element(dot).toBeVisible();
    await expect.element(dot).toHaveStyle({ "width": "14px" });
    expect(getComputedStyle(css("span", dot)).backgroundColor).toBe(color("--ink-100"));
    expect(getComputedStyle(css("span", dot)).width).toBe("4px");
    expect(getComputedStyle(css("span", dot)).height).toBe("4px");
    // An agent row is ink-60, weight 400.
    await expect.element(notes).toHaveStyle({ "color": color("--ink-60") });
    await expect.element(notes).toHaveStyle({ fontWeight: "400" });
    // Each project name is ink-85, the shown agent's project too.
    expect(getComputedStyle(css("[data-name]", desktop)).color).toBe(color("--ink-85"));
    expect(getComputedStyle(css("[data-name]", herdr)).color).toBe(color("--ink-85"));
    // The chevron is the text "▼", 9 px, ink-35, 10 px wide.
    const chev = desktop.getByRole("button", { name: "Collapse contr-desktop" });
    await expect.element(chev).toHaveTextContent("▼");
    await expect.element(chev).toHaveStyle({ fontSize: "9px" });
    await expect.element(chev).toHaveStyle({ "width": "10px" });
    await expect.element(chev).toHaveStyle({ "color": color("--ink-35") });
    // The Projects "+" is ink-50.
    await expect.element(nav.getByRole("button", { name: "Add project" })).toHaveStyle({ "color": color("--ink-50") });
    // Under the 40 px head (#241, screens.html): the Inbox row 2 px down (`.nav` margin-top), the Projects label 6 px under it.
    const head = css("aside header").getBoundingClientRect();
    const inbox = rect(nav.getByRole("button", { name: /^Inbox/ }));
    const label = nav.getByRole("heading", { name: "Projects" }).element().parentElement!.getBoundingClientRect();
    expect([inbox.top - head.bottom, label.top - inbox.bottom]).toEqual([2, 6]);
    await shot(`sidebar-mock-${scheme}`);
  }
  await notes.click();
  await expect.element(notes).toHaveAttribute("aria-current", "true");
  await expect.poll(() => dot.elements().length).toBe(0);
  await desktop.getByRole("button", { name: "Collapse contr-desktop" }).click();
  await expect.element(desktop.getByRole("button", { name: "Expand contr-desktop" })).toHaveTextContent("▶\uFE0E");
});

test("a worker's chat: the reply box names it as its tab does, and the chat, model, context and status line are its own (#90)", async () => {
  const selection = selectable(sidebar);
  await renderApp(transcript, null, {
    ...selection.overrides,
    onFeed(listener) {
      const terminal = selection.selected();
      const fixture = terminal === "t8" ? b30 : terminal === "t9" ? b40 : transcript;
      listener({ type: "splice", at: 0, rows: rows(fixture), agent: "claude" });
      listener({ type: "working", working: terminal === "t8"
        ? { text: "Drawing…", detail: "2m 4s · ↓ 3.1k tokens" }
        : terminal === "t9" ? { text: null, detail: null } : { text: "Hashing…", detail: "35s · ↓ 1.2k tokens" } });
      listener({ type: "card", card: terminal === "t9" ? { ...approval, kind: "approval", answered: false } : null });
      return () => {};
    },
    replyInfo: async () => selection.selected() === "t8"
      ? replyInfo(22, "claude-sonnet-5", "high")
      : selection.selected() === "t9" ? replyInfo(58, "claude-opus-5-5", "high") : replyInfo(),
  });
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });

  // The tab and reply box use the title in the sidebar payload.
  await nav.getByRole("button", { name: /Cards for prompts and questions/ }).click();
  await expect.element(tabs.getByRole("tab", { name: "Cards for prompts and questions" })).toHaveAttribute("aria-selected", "true");
  const box = page.getByRole("textbox", { name: "Reply to Cards for prompts and questions" });
  await expect.element(box).toHaveAttribute("placeholder", "Reply to Cards for prompts and questions");
  const chat = page.getByRole("list", { name: "Chat" });
  await expect.poll(() => chat.element().textContent).toContain('Issue #40 of contr-desktop: "Cards for prompts and questions"');
  await expect.poll(() => chat.element().textContent).toContain("Unit tests pass. Now the e2e test for the cards.");
  await expect.element(page.getByRole("button", { name: "Model" })).toHaveTextContent("Opus 5.5high");
  await expect.element(page.getByLabelText("Context 58%")).toHaveTextContent("58%");
  // The card comes on the same tick after the working line: once it shows, the status line has had b-40's answer.
  await expect.element(page.getByRole("region", { name: "Approval" })).toBeVisible();
  await expect.poll(() => page.getByLabelText("Status").getByRole("status").elements().length).toBe(0);
  await expect.poll(() => page.getByLabelText("Status").element().textContent).not.toContain("Hashing");
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await shot(`worker-chat-${scheme}`);
  }

  // b-30 (t8) works: its own working line, model and effort.
  await nav.getByRole("button", { name: /Flow and sequence diagrams/ }).click();
  await expect.element(page.getByRole("textbox", { name: "Reply to Flow and sequence diagrams" })).toBeVisible();
  await expect.poll(() => page.getByLabelText("Status").element().textContent).toContain("Drawing…");
  await expect.element(page.getByRole("button", { name: "Model" })).toHaveTextContent("Sonnet 5high");
  await expect.element(page.getByLabelText("Context 22%")).toHaveTextContent("22%");
});
