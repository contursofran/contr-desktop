import { vi } from "vitest";
import { commands, page, type Locator } from "vitest/browser";
import bash from "../e2e/fixtures/cards/bash-permission.json";
import edit from "../e2e/fixtures/cards/edit-permission.json";
import multi from "../e2e/fixtures/cards/multi-question.json";
import question from "../e2e/fixtures/cards/question.json";
import transcript from "../e2e/fixtures/claude-session.jsonl?raw";
import ownerFixture from "../e2e/fixtures/owner/open.json?raw";
import { parseOwnerOpen } from "../src/main/owner/owner";
import type { Card, ContrApi, OwnerItems, RefState } from "../src/shared/api";
import { browserShots, normalizedText } from "./273-chatRows";
import { renderApp } from "./renderApp";

export const bashCard = { ...bash, kind: "approval", answered: false } satisfies Card;
export const editCard = { ...edit, kind: "approval", answered: false } satisfies Card;
export const questionCard = { ...question, kind: "question", question: { ...question.question, delivery: "picker" } } satisfies Card;
export const multiCard = { ...multi, kind: "question", question: { ...multi.question, delivery: "picker" } } satisfies Card;

export const draftRef = {
  kind: "pr", state: "draft", url: "https://github.com/o/r/pull/15", checks: { state: "pending", passed: 4, failed: 0, total: 6 },
} satisfies RefState;

export async function renderCards(card: Card | null, overrides: Partial<ContrApi> = {}, result = "sent") {
  const approve = vi.fn<ContrApi["approve"]>().mockResolvedValue({ result });
  const answer = vi.fn<ContrApi["answer"]>().mockResolvedValue({ result });
  await renderApp(transcript, card, { approve, answer, ...overrides });
  return { approve, answer };
}

/** Read text for polling assertions that match a substring or pattern. */
export function textOf(locator: Locator) {
  const [element] = locator.elements();
  return element ? normalizedText(element) : "";
}

export function blur() {
  (document.activeElement as HTMLElement | null)?.blur();
}

export async function shoot(name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished));
    await page.screenshot({ path: `${browserShots}/${name}-${scheme}.png` });
  }
}

/** A push stream for the owner reads in both the chat and the Inbox. */
export function ownerFake(ids?: string[]) {
  let items = parseOwnerOpen(ownerFixture);
  if (ids) items = {
    questions: items.questions.filter((item) => ids.includes(item.id)),
    todos: items.todos.filter((item) => ids.includes(item.id)),
  };
  let error: string | null = null;
  const itemListeners = new Set<(items: OwnerItems) => void>();
  const errorListeners = new Set<(error: string | null) => void>();
  const close = (id: string) => {
    items = { questions: items.questions.filter((q) => q.id !== id), todos: items.todos.filter((t) => t.id !== id) };
    for (const listener of itemListeners) listener(items);
    return { ok: true, note: null };
  };
  const ownerAnswer = vi.fn<ContrApi["ownerAnswer"]>(async (id) => close(id));
  const ownerDone = vi.fn<ContrApi["ownerDone"]>(async (id) => close(id));
  const api = {
    owner: async () => items,
    onOwner(listener) {
      itemListeners.add(listener);
      return () => { itemListeners.delete(listener); };
    },
    ownerError: async () => error,
    onOwnerError(listener) {
      errorListeners.add(listener);
      return () => { errorListeners.delete(listener); };
    },
    ownerAnswer,
    ownerDone,
  } satisfies Partial<ContrApi>;
  return {
    api, ownerAnswer, ownerDone,
    setError(next: string | null) {
      error = next;
      for (const listener of errorListeners) listener(error);
    },
  };
}
