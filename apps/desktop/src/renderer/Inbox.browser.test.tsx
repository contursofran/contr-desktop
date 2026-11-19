import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import workerPermission from "../../e2e/fixtures/workers/b-40-card.json";
import { normalizedText } from "../../test/273-chatRows";
import { sidebar as fixtureSidebar } from "../../test/275-sidebar";
import { blur, draftRef, ownerFake, questionCard, renderCards, shoot, textOf } from "../../test/280-browser";
import type { Card, ContrApi } from "../shared/api";

const nav = page.getByRole("navigation", { name: "Projects" });
const inbox = nav.getByRole("button", { name: /^Inbox/ });
const list = page.getByRole("region", { name: "Inbox" });
const ownerQuestion = list.getByRole("region", { name: "Owner question" });
const items = () => Array.from(list.element().querySelectorAll("[data-item]"));
const row = (id: string) => list.element().querySelector(`[data-item="${id}"]`);
const item = (id: string) => page.elementLocator(row(id)!);

function sidebarWithBlocked(terminal?: string) {
  const sidebar = structuredClone(fixtureSidebar);
  const [coordinator, notes] = sidebar.projects[0].agents;
  coordinator.workers.find((worker) => worker.terminal === "t9")!.state = terminal === "t9" ? "blocked" : "done";
  notes.state = terminal === "t11" ? "blocked" : "done";
  return sidebar;
}

function blockedFake(terminal: string, card: Card) {
  let sidebar = sidebarWithBlocked(terminal);
  const listeners = new Set<(data: typeof sidebar) => void>();
  const select = vi.fn<ContrApi["select"]>(async (selected) => {
    sidebar = { ...sidebar, selected };
    return selected;
  });
  const api = {
    sidebar: async () => sidebar,
    onSidebar(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    select,
    onFeed(listener) {
      if (sidebar.selected === terminal) listener({ type: "card", card });
      return () => {};
    },
  } satisfies Partial<ContrApi>;
  return {
    api, select,
    resume() {
      sidebar = { ...sidebarWithBlocked(), selected: sidebar.selected };
      for (const listener of listeners) listener(sidebar);
    },
  };
}

test("the Inbox opens items oldest first; answering here closes the item everywhere", async () => {
  const owner = ownerFake();
  await renderCards(null, { ...owner.api, sidebar: async () => sidebarWithBlocked(), refs: async () => ({ 15: draftRef }) });
  await expect.element(inbox).toHaveTextContent("Inbox5");
  await expect.poll(() => textOf(nav)).toMatch(/Install health check/);
  await shoot("inbox-row");
  await inbox.click();
  await expect.element(inbox).toHaveAttribute("aria-current", "true");
  await expect.poll(() => textOf(list)).toMatch(/Inbox5 open · oldest first/);
  const texts = items().map(normalizedText);
  expect(texts).toHaveLength(5);
  expect(texts[0]).toMatch(/^D7Question · Inbox order · from b-15 · Chat panel usability auditWhich items show first in the inbox\?/);
  expect(texts.slice(1)).toEqual([
    "D8Does the Dock badge count to-dos?Question · Dock badge · from b-16 · Chat panel usability audit2 answers",
    "D9Not for this chat.Question · Other · from b-30 · Install health check1 answer",
    "T3Log in to the staging server, then run pnpm e2e in apps/desktop.To do · from b-15 · Chat panel usability auditDone",
    "T4The CI cache is now keyed on the lockfile.To know · from b-16 · Chat panel usability auditDone",
  ]);
  expect(ownerQuestion.elements()).toHaveLength(1);
  await expect.poll(() => textOf(list)).not.toMatch(/more after this/);
  const card = item("D7");
  expect(card.getByRole("img", { name: "Needs you" }).elements()).toHaveLength(1);
  expect(card.element().querySelectorAll("section")).toHaveLength(0);
  const style = getComputedStyle(card.element());
  expect([style.borderRadius, style.paddingTop, style.paddingLeft, style.marginTop, style.gridTemplateColumns.split(" ")[0]]).toEqual(["12px", "12px", "10px", "6px", "16px"]);
  const oldest = card.getByRole("radio", { name: "Oldest first · recommended", exact: true });
  await expect.element(oldest).toBeChecked();
  await expect.element(card.getByRole("button", { name: "Send answer" })).toBeEnabled();
  await expect.poll(() => card.element().querySelector('[data-ref-kind="pr"]')?.getAttribute("aria-label")).toMatch(/^PR #15/);
  await shoot("inbox-list");

  const newest = card.getByRole("radio", { name: "Newest first", exact: true });
  (await oldest.findElement()).focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(newest).toHaveFocus();
  await expect.element(newest).toBeChecked();
  blur();
  await userEvent.keyboard("{ArrowDown}");
  await expect.poll(() => textOf(ownerQuestion)).toMatch(/Does the Dock badge count to-dos\?/);
  expect(normalizedText(row("D7")!)).toMatch(/^D7Which items show first in the inbox\?Question · Inbox order/);
  await userEvent.keyboard("{ArrowUp}");
  await expect.poll(() => textOf(ownerQuestion)).toMatch(/Which items show first in the inbox\?/);
  await userEvent.keyboard("{ArrowDown}2");
  await expect.poll(() => row("D8")).toBeNull();

  await item("D9").getByRole("button").click();
  const fallback = item("D9").getByRole("radio", { name: "Ok", exact: true });
  await expect.element(fallback).toBeChecked();
  await fallback.click();
  await expect.poll(() => row("D9")).toBeNull();
  await item("T3").getByRole("button", { name: "Done" }).click();
  await expect.poll(() => items().length).toBe(2);
  await expect.element(inbox).toHaveTextContent("Inbox2");
  expect(owner.ownerAnswer.mock.calls).toEqual([["D8", "No"], ["D9", "Ok"]]);
  expect(owner.ownerDone.mock.calls).toEqual([["T3"]]);
  await nav.getByRole("button", { name: /Chat panel usability audit/ }).click();
  await expect.element(list).not.toBeInTheDocument();
  await expect.poll(() => textOf(page.getByRole("region", { name: "Owner to-do" }))).toMatch(/T4The CI cache is now keyed on the lockfile\.To know · from b-16/);
});

test("a blocked agent opens its question and leaves the Inbox when it goes on", async () => {
  const blocked = blockedFake("t11", questionCard);
  const { answer } = await renderCards(null, { ...ownerFake(["D9"]).api, ...blocked.api });
  await expect.element(inbox).toHaveTextContent("Inbox2");
  await inbox.click();
  await expect.element(list).toBeVisible();
  const texts = items().map(normalizedText);
  expect(texts).toHaveLength(2);
  expect(texts[0]).toMatch(/^D9Question · Other · from b-30 · Install health checkNot for this chat\./);
  expect(texts[1]).toBe("Release notes draftWaits on a promptOpen chat");
  await shoot("inbox-blocked");

  await item("t11").getByRole("button").click();
  await expect.element(list).not.toBeInTheDocument();
  const card = page.getByRole("region", { name: "Question" });
  await expect.poll(() => textOf(card)).toMatch(/Where should the draft text be kept\?/);
  await card.getByRole("radio", { name: "localStorage", exact: true }).click();
  await expect.poll(() => textOf(card)).toMatch(/Answer sent\. Waiting for the agent\./);
  expect(blocked.select.mock.calls).toEqual([["t11"]]);
  expect(answer.mock.calls).toEqual([[questionCard.request, [{ picks: [1] }]]]);
  blocked.resume();
  await expect.element(inbox).toHaveTextContent("Inbox1");
});

test("a blocked worker opens its chat and permission card", async () => {
  const blocked = blockedFake("t9", { ...workerPermission, kind: "approval", answered: false });
  await renderCards(null, blocked.api);
  await expect.element(inbox).toHaveTextContent("Inbox1");
  await expect.element(nav.getByRole("button", { name: /Cards for prompts and questions/ }).getByRole("img", { name: "Needs you" })).toBeVisible();
  await inbox.click();
  await expect.element(list).toBeVisible();
  expect(items().map(normalizedText)).toEqual(["Cards for prompts and questionsWaits on a promptOpen chat"]);
  await item("t9").getByRole("button").click();
  await expect.element(list).not.toBeInTheDocument();
  await expect.element(page.getByRole("textbox", { name: "Reply to Cards for prompts and questions" })).toBeVisible();
  await expect.element(page.getByRole("region", { name: "Approval" })).toBeVisible();
  expect(blocked.select.mock.calls).toEqual([["t9"]]);
});

test("a failed owner read keeps the last good items and typed text until recovery", async () => {
  const owner = ownerFake();
  await renderCards(null, { ...owner.api, sidebar: async () => sidebarWithBlocked() });
  const cards = page.getByRole("region", { name: /^Owner/ });
  const chatAnswer = cards.getByRole("textbox", { name: "Own answer" });
  const note = page.getByRole("alert").filter({ hasText: /Cannot read the owner items/ });
  const failure = "herdr-contr-orch gave no JSON list";
  await expect.element(chatAnswer).toBeVisible();
  expect(cards.elements()).toHaveLength(2);
  await chatAnswer.fill("typed in the chat");
  owner.setError(failure);
  // Let React process the failure event even though the chat has no error notice.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(cards.elements()).toHaveLength(2);
  await expect.element(chatAnswer).toHaveValue("typed in the chat");
  await expect.element(inbox).toHaveTextContent("Inbox5");
  owner.setError(null);
  await inbox.click();
  await expect.element(list).toBeVisible();
  expect(items()).toHaveLength(5);
  await expect.element(note).not.toBeInTheDocument();

  const inboxAnswer = item("D7").getByRole("textbox", { name: "Own answer" });
  await inboxAnswer.fill("typed in the Inbox");
  owner.setError(failure);
  await expect.element(note).toHaveTextContent(`Cannot read the owner items: ${failure}`);
  expect(items()).toHaveLength(5);
  await expect.poll(() => textOf(list)).not.toMatch(/Nothing needs you\./);
  await expect.element(inbox).toHaveTextContent("Inbox5");
  await expect.element(inboxAnswer).toHaveValue("typed in the Inbox");
  await shoot("owner-read-failed");

  owner.setError(null);
  await expect.element(note).not.toBeInTheDocument();
  expect(items()).toHaveLength(5);
  await expect.element(inboxAnswer).toHaveValue("typed in the Inbox");
});
