import { expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots } from "../../test/273-chatRows";
import { contrFake } from "../../test/contrFake";
import { renderApp } from "../../test/renderApp";
import type { TerminalApi } from "../shared/api";

const plus = page.getByRole("button", { name: "New tab", exact: true });
const menu = page.getByRole("menu", { name: "New tab" });
const terminal = menu.getByRole("menuitem", { name: "Terminal" });
const claude = menu.getByRole("menuitem", { name: "Claude Code" });
const original = page.getByRole("tab", { name: "Chat panel usability audit" });

async function renderNewTab(start: NonNullable<TerminalApi["start"]>) {
  const api = contrFake([], null);
  await renderApp(transcript, null, {
    terminal: { ...api.terminal, start },
    tabTitle: async () => ({ title: "Claude Code", kind: "claude-code" }),
  });
  await expect.element(original).toHaveAttribute("aria-selected", "true");
}

test("New tab opens from + and Command+T, with Terminal focused first", async () => {
  const start = vi.fn(async () => {
    expect(plus.element()).toHaveAttribute("aria-expanded", "false");
    return { terminal: "t-new" };
  });
  await renderNewTab(start);

  await plus.click();
  await expect.element(terminal).toHaveFocus();
  expect(menu.getByRole("menuitem").elements().map((item) => item.getAttribute("aria-keyshortcuts"))).toEqual([null, "1", "2"]);
  expect(menu.getByRole("group", { name: "Start an agent" }).getByRole("menuitem").elements()).toHaveLength(2);
  for (const [width, height, scheme] of [[640, 480, "dark"], [1400, 900, "light"]] as const) {
    await page.viewport(width, height);
    await commands.colorScheme(scheme);
    await expect.element(terminal).toHaveFocus();
    await page.screenshot({ path: `${browserShots}/262-new-tab-menu-${scheme}.png` });
  }

  await userEvent.keyboard("{Escape}");
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(plus).toHaveFocus();
  expect(start).not.toHaveBeenCalled();

  const reply = page.getByRole("textbox", { name: "Reply to Chat panel usability audit" });
  (await reply.findElement()).focus();
  await userEvent.keyboard("{Meta>}t{/Meta}");
  await expect.element(terminal).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(claude).toHaveFocus();
  await userEvent.keyboard("1");

  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(page.getByRole("tab", { name: "Claude Code" })).toHaveAttribute("aria-selected", "true");
  expect(page.getByRole("tab", { name: "Claude Code" }).element().querySelector('[data-icon="claude-code"]')).toBeTruthy();
  expect(start).toHaveBeenCalledExactlyOnceWith("claude", "/work/contr-desktop");
});

test("a failed close keeps the tab and a successful retry removes it", async () => {
  const api = contrFake([], null);
  const close = vi.fn<TerminalApi["close"]>()
    .mockResolvedValueOnce({ error: "hc is unavailable" })
    .mockResolvedValueOnce({ ok: true });
  await renderApp(transcript, null, { terminal: { ...api.terminal, close } });
  const closeButton = page.getByRole("button", { name: "Close Chat panel usability audit" });
  await closeButton.click();
  const error = page.getByRole("alert", { name: "Close tab error" });
  await expect.element(error).toHaveTextContent("Cannot close the tab. hc is unavailable");
  await expect.element(original).toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{Meta>}w{/Meta}");
  await expect.element(original).not.toBeInTheDocument();
  await expect.element(error).not.toBeInTheDocument();
  expect(close.mock.calls).toEqual([["t7"], ["t7"]]);
});

test("New tab shows the launch error and keeps the selected tab", async () => {
  const start = vi.fn(async () => ({ error: "fake hc: cannot start program" }));
  await renderNewTab(start);
  await plus.click();
  await menu.getByRole("menuitem", { name: "Codex" }).click();

  await expect.element(page.getByRole("alert", { name: "New terminal error" }))
    .toHaveTextContent("Cannot start a terminal. fake hc: cannot start program");
  await expect.element(original).toHaveAttribute("aria-selected", "true");
  expect(page.getByRole("tab").elements()).toHaveLength(1);
  expect(start).toHaveBeenCalledExactlyOnceWith("codex", "/work/contr-desktop");
});
