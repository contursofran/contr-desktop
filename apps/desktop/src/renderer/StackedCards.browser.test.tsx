import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { normalizedText } from "../../test/273-chatRows";
import { bashCard, blur, ownerFake, questionCard, renderCards, shoot, textOf } from "../../test/280-browser";

test("with the agent's card and an owner question, key 1 answers only the agent's card", async () => {
  const owner = ownerFake();
  const { approve } = await renderCards(bashCard, owner.api);
  const approval = page.getByRole("region", { name: "Approval" });
  const q = page.getByRole("region", { name: "Owner question" });
  await expect.element(approval).toBeVisible();
  await expect.poll(() => textOf(q)).toMatch(/D7 · The coordinator asks/);
  expect(approval.getByRole("button").elements().map(normalizedText)).toEqual(["1Allow once", "2Deny"]);
  expect(q.getByRole("radio").elements().map(normalizedText)).toEqual([
    "Oldest first · recommendedMatches the design; nothing waits forever.",
    "Newest firstNew work shows at once; old items wait.",
  ]);
  blur();
  await userEvent.keyboard("1");
  await expect.poll(() => textOf(approval)).toMatch(/Answer sent\. Waiting for the agent\./);
  expect(approve.mock.calls).toEqual([[bashCard.request, true]]);
  expect(owner.ownerAnswer).not.toHaveBeenCalled();
  expect(owner.ownerDone).not.toHaveBeenCalled();
  await expect.poll(() => textOf(q)).toMatch(/D7 · The coordinator asks/);
});

function layout() {
  const reply = document.querySelector("textarea")!.getBoundingClientRect();
  const list = document.querySelector('[aria-label="Chat"]')!.getBoundingClientRect();
  const cards = document.querySelector('[aria-label="Cards"]')!;
  return { list: list.height, replyTop: reply.top, replyBottom: reply.bottom, cards: cards.getBoundingClientRect().height, scrolls: cards.scrollHeight > cards.clientHeight };
}

test.each([[640, 480], [900, 600]])("three stacked cards at %ix%i scroll inside and keep the reply box visible", async (width, height) => {
  await renderCards(questionCard, ownerFake().api);
  await page.viewport(width, height);
  expect(window.innerHeight).toBe(height);
  const question = page.getByRole("region", { name: "Question", exact: true });
  await expect.element(question).toBeVisible();
  await expect.element(page.getByRole("region", { name: "Owner question" })).toBeVisible();
  await expect.element(page.getByRole("region", { name: "Owner to-do" })).toBeVisible();
  const reply = page.getByRole("textbox", { name: /Reply to/ });
  await reply.clear();
  await expect.element(reply).toHaveValue("");
  await expect.poll(() => layout().scrolls).toBe(true);
  const first = layout();
  expect(first.cards).toBeLessThanOrEqual(height * 0.45 + 1);
  expect(first.list).toBeGreaterThanOrEqual(120);
  expect(first.replyBottom).toBeLessThanOrEqual(height);
  await expect.element(question).toBeInViewport({ ratio: 0.5 });

  await reply.fill("one\ntwo\nthree\nfour\nfive\nsix");
  await expect.poll(() => layout().replyTop).toBeLessThan(first.replyTop - 40);
  const tall = layout();
  expect(tall.list).toBeGreaterThanOrEqual(120);
  expect(tall.replyBottom).toBeLessThanOrEqual(height);
  await expect.element(reply).toBeInViewport();
  await reply.clear();
});

test("screenshots of stacked cards at 640x480 and 1440x900", async () => {
  await renderCards(questionCard, ownerFake().api);
  await page.getByRole("textbox", { name: /Reply to/ }).clear();
  await expect.element(page.getByRole("region", { name: "Question", exact: true })).toBeVisible();
  await expect.element(page.getByRole("list", { name: "Chat" }).getByRole("listitem").first()).toBeVisible();
  for (const [width, height] of [[640, 480], [1440, 900]] as const) {
    await page.viewport(width, height);
    expect(window.innerHeight).toBe(height);
    await expect.element(page.getByRole("region", { name: "Owner to-do" })).toBeVisible();
    await shoot(`stacked-cards-${width}`);
  }
});
