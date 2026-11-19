import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { chatRow } from "../../test/273-chatRows";
import { bashCard, blur, multiCard, renderCards, shoot, textOf } from "../../test/280-browser";

test("a 1 typed in the reply box stays text; a 1 with focus on the page answers", async () => {
  const { approve } = await renderCards(bashCard);
  const card = page.getByRole("region", { name: "Approval" });
  await expect.element(card.getByRole("button", { name: /Allow once/ })).toHaveAttribute("aria-keyshortcuts", "1 Enter");
  await expect.element(card.getByRole("button", { name: /Deny/ })).toHaveAttribute("aria-keyshortcuts", "2");
  const reply = page.getByRole("textbox", { name: /Reply to/ });
  (await reply.findElement()).focus();
  await userEvent.keyboard("1");
  await expect.element(reply).toHaveValue("1");
  await expect.element(card.getByRole("status")).not.toBeInTheDocument();
  expect(approve).not.toHaveBeenCalled();
  await shoot("keys-card-reply-text");
  blur();
  await userEvent.keyboard("1");
  await expect.poll(() => textOf(card)).toMatch(/Answer sent\. Waiting for the agent\./);
  await expect.element(reply).toHaveValue("1");
  expect(approve.mock.calls).toEqual([[bashCard.request, true]]);
});

test("digits in Own answer or a menu stay text; Enter on a tool disclosure opens it", async () => {
  const { answer } = await renderCards(multiCard, {
    replyInfo: async () => ({
      agent: "claude", model: "claude-opus-5-5", effort: "high", tier: null, tiers: [], speed: null,
      context: { percent: 37, text: "37%", warn: false },
      models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }], efforts: [],
    }),
  });
  const card = page.getByRole("region", { name: "Question" });
  const typecheck = card.getByRole("checkbox", { name: "Typecheck", exact: true });
  await expect.element(typecheck).toHaveAttribute("aria-keyshortcuts", "1");
  await expect.element(card.getByRole("button", { name: "Next" })).toHaveAttribute("aria-keyshortcuts", "Enter");
  const own = card.getByRole("textbox", { name: "Own answer" });
  await expect.element(own).toHaveAttribute("aria-keyshortcuts", "4");
  (await own.findElement()).focus();
  await userEvent.keyboard("2");
  await expect.element(own).toHaveValue("2");
  await expect.element(card.getByRole("checkbox", { name: "Lint", exact: true })).not.toBeChecked();

  await page.getByRole("button", { name: "Model" }).click();
  await expect.element(page.getByRole("menu", { name: "Model" })).toBeVisible();
  await expect.poll(() => !!document.activeElement?.closest("[role=menu]")).toBe(true);
  await userEvent.keyboard("1{Escape}");
  await expect.element(typecheck).not.toBeChecked();

  await chatRow("a1-t1");
  const chip = page.getByRole("button", { name: "Searched 2 patterns, read 1 file", exact: true });
  (await chip.findElement()).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(chip).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => textOf(card)).toMatch(/Checks · 1 of 2/);
  blur();
  await userEvent.keyboard("1");
  await expect.element(typecheck).toBeChecked();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => textOf(card)).toMatch(/Branch · 2 of 2/);
  expect(answer).not.toHaveBeenCalled();
});

test("Tab goes from the top bar to the card and the reply box before the chat rows", async () => {
  await renderCards(bashCard, {
    board: async () => ({ workers: {}, roles: {}, agent: "t7", checks: {}, orchestrating: 0 }),
  });
  await expect.element(page.getByRole("button", { name: "Orchestrate" })).toBeVisible();
  const reply = page.getByRole("textbox", { name: /Reply to/ });
  await expect.element(page.getByRole("region", { name: "Approval" })).toBeVisible();
  (await page.getByRole("radio", { name: "Terminal" }).findElement()).focus();
  const stops: string[] = [];
  for (let i = 0; i < 6 && reply.element() !== document.activeElement; i++) {
    await userEvent.keyboard("{Tab}");
    const el = document.activeElement!;
    stops.push(`${el.closest('[aria-label="Chat"]') ? "row " : ""}${el.getAttribute("aria-label") ?? el.textContent}`);
  }
  expect(stops).toEqual(["1Allow once", "2Deny", "Orchestrate", "Reply to Chat panel usability audit"]);
  const list = page.getByRole("list", { name: "Chat" }).element().getBoundingClientRect();
  expect(reply.element().getBoundingClientRect().top).toBeGreaterThan(list.bottom - 1);
  await shoot("keys-reply-focus");
});

test("a code block is a Tab stop only when it scrolls sideways", async () => {
  await renderCards(null);
  const list = await page.getByRole("list", { name: "Chat" }).findElement();
  const pres = () => Array.from(list.querySelectorAll<HTMLElement>(".chat-markdown-codeblock pre"));
  await expect.poll(() => pres().length).toBeGreaterThan(0);
  await expect.element(page.elementLocator(pres()[0])).toBeVisible();
  const state = () => pres().map((p) => ({ stop: p.tabIndex === 0, scrolls: p.scrollWidth > p.clientWidth }));
  await expect.poll(() => state().every((p) => p.stop === p.scrolls)).toBe(true);
  expect(state().some((p) => p.stop)).toBe(false);

  await page.viewport(640, 600);
  await expect.poll(() => {
    const blocks = state();
    return blocks.some((p) => p.stop) && blocks.every((p) => p.stop === p.scrolls);
  }).toBe(true);
  const scrollable = pres().find((p) => p.tabIndex === 0)!;
  scrollable.focus();
  await expect.element(page.elementLocator(scrollable)).toHaveFocus();
  await shoot("keys-code-scroll");
});
