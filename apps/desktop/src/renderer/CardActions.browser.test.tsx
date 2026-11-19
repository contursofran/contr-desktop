import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { normalizedText } from "../../test/273-chatRows";
import { bashCard, blur, editCard, multiCard, questionCard, renderCards, shoot, textOf } from "../../test/280-browser";

const key = (key: string) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

async function shootCard(name: string) {
  const list = await page.getByRole("list", { name: "Chat" }).findElement();
  await expect.poll(() => {
    const last = list.querySelectorAll("[role=listitem]");
    const row = last[last.length - 1]?.getBoundingClientRect();
    const card = Array.from(document.querySelectorAll("section")).at(-1)?.getBoundingClientRect();
    return !!row && !!card && row.bottom <= card.top + 1 && row.bottom <= list.getBoundingClientRect().bottom + 1;
  }).toBe(true);
  await shoot(name);
}

test("a Bash permission card allows with key 1", async () => {
  const { approve } = await renderCards(bashCard);
  const section = page.getByRole("region", { name: "Approval" });
  await expect.poll(() => textOf(section)).toMatch(/Bash command/);
  await expect.poll(() => textOf(section)).toMatch(/pnpm --filter desktop exec playwright test e2e\/app\.spec\.ts/);
  expect(section.getByRole("button").elements().map(normalizedText)).toEqual(["1Allow once", "2Deny"]);
  await shootCard("card-bash");
  // A key typed in the reply box stays there.
  (await page.getByRole("textbox", { name: /Reply to/ }).findElement()).focus();
  // The card's key handler calls preventDefault when it takes a key: here it must not.
  expect(key("1")).toBe(true);
  await expect.element(section.getByRole("status")).not.toBeInTheDocument();
  blur();
  key("1");
  await expect.poll(() => textOf(section)).toMatch(/Answer sent\. Waiting for the agent\./);
  await expect.element(section.getByRole("button", { name: /Allow once/ })).toBeDisabled();
  expect(approve.mock.calls).toEqual([["toolu_01HxQ7bVf3kPz9Ns2RtLmW4d", true]]);
});

test("an Edit permission card denies, and a changed prompt says so", async () => {
  const { approve } = await renderCards(editCard, {}, "changed");
  const section = page.getByRole("region", { name: "Approval" });
  await expect.poll(() => textOf(section)).toMatch(/Edit file/);
  await expect.poll(() => textOf(section)).toMatch(/apps\/desktop\/src\/renderer\/chat\/reply\/ReplyBox\.tsx/);
  await shootCard("card-edit");
  await section.getByRole("button", { name: /Deny/ }).click();
  await expect.poll(() => textOf(section)).toMatch(/It changed on screen\. Here is what it shows now\./);
  expect(approve.mock.calls).toEqual([["toolu_01Kd8sYp2VwQe5Lr7JmNc3Tb", false]]);
});

test("a question card sends the pick of key 2", async () => {
  const { answer } = await renderCards(questionCard);
  const section = page.getByRole("region", { name: "Question" });
  await expect.poll(() => textOf(section)).toMatch(/Where should the draft text be kept\?/);
  await expect.poll(() => textOf(section)).toMatch(/Memory only · recommendedLost when the window closes/);
  await shootCard("card-question");
  key("2");
  await expect.poll(() => textOf(section)).toMatch(/Answer sent\. Waiting for the agent\./);
  expect(answer.mock.calls).toEqual([["toolu_01Ra4mVn6ZcX2bQ8tWy5Hk9p", [{ picks: [1] }]]]);
});

test("the agent radio group moves the pick with arrows and sends it with Enter", async () => {
  const { answer } = await renderCards(questionCard);
  const group = page.getByRole("radiogroup", { name: "Where should the draft text be kept?" });
  const first = group.getByRole("radio", { name: "Memory only · recommended", exact: true });
  const second = group.getByRole("radio", { name: "localStorage", exact: true });
  await expect.element(first).toBeChecked();
  (await first.findElement()).focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(second).toHaveFocus();
  await expect.element(second).toBeChecked();
  await expect.element(first).not.toBeChecked();
  expect(answer).not.toHaveBeenCalled();
  (await second.findElement()).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("status").filter({ hasText: /Answer sent\. Waiting for the agent\./ })).toBeVisible();
  expect(answer.mock.calls).toEqual([["toolu_01Ra4mVn6ZcX2bQ8tWy5Hk9p", [{ picks: [1] }]]]);
});

test("a multi-select question takes picks, then the next question's own answer", async () => {
  const { answer } = await renderCards(multiCard);
  const section = page.getByRole("region", { name: "Question" });
  await expect.poll(() => textOf(section)).toMatch(/Checks · 1 of 2 · pick any/);
  const group = section.getByRole("group", { name: "Which checks should run before the push?" });
  const lint = group.getByRole("checkbox", { name: "Lint", exact: true });
  (await lint.findElement()).focus();
  await userEvent.keyboard(" ");
  await expect.element(lint).toBeChecked();
  (await lint.findElement()).focus();
  await userEvent.keyboard(" ");
  await expect.element(lint).not.toBeChecked();
  key("1");
  await expect.element(group.getByRole("checkbox", { name: "Typecheck", exact: true })).toBeChecked();
  key("3");
  await expect.element(section.getByRole("checkbox", { name: "Tests · recommended", exact: true })).toBeChecked();
  await shootCard("card-multi");
  (lint.element() as HTMLElement).blur();
  key("Enter");
  await expect.poll(() => textOf(section)).toMatch(/Merge main into the branch first\?/);
  key("3");
  await expect.element(section.getByRole("textbox", { name: "Own answer" })).toHaveFocus();
  await section.getByRole("textbox", { name: "Own answer" }).fill("Only after CI passes");
  await section.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => textOf(section)).toMatch(/Answer sent\. Waiting for the agent\./);
  expect(answer.mock.calls).toEqual([["toolu_01Wm3Fq8Lz5Yt2Nd6Xc9Bv4s", [{ picks: [0, 2] }, { picks: [], other: "Only after CI passes" }]]]);
});

test("Enter on a pick-any question with nothing picked does nothing; a one-choice question starts with its first answer picked", async () => {
  const { answer } = await renderCards(multiCard);
  const section = page.getByRole("region", { name: "Question" });
  await expect.poll(() => textOf(section)).toMatch(/Checks · 1 of 2 · pick any/);
  await expect.element(section.getByRole("button", { name: "Next" })).toBeDisabled();
  key("Enter");
  key("Enter");
  await expect.poll(() => textOf(section)).toMatch(/Checks · 1 of 2 · pick any/);
  key("1");
  await expect.element(section.getByRole("button", { name: "Next" })).toBeEnabled();
  key("Enter");
  await expect.poll(() => textOf(section)).toMatch(/Branch · 2 of 2/);
  // The first answer is picked (screens.html `.opt.is-picked`): it has the hover fill, and Enter sends it.
  await commands.colorScheme("dark");
  const yes = section.getByRole("radio", { name: "Yes · recommended", exact: true });
  await expect.element(yes).toBeChecked();
  // `--hover` in dark, rgba(255,255,255,0.045): Chromium rounds the alpha to 8 bits.
  expect(getComputedStyle(yes.element()).backgroundColor).toBe("rgba(255, 255, 255, 0.043)");
  await expect.element(section.getByRole("button", { name: "Send" })).toBeEnabled();
  key("Enter");
  await expect.poll(() => textOf(section)).toMatch(/Answer sent\. Waiting for the agent\./);
  expect(answer.mock.calls).toEqual([["toolu_01Wm3Fq8Lz5Yt2Nd6Xc9Bv4s", [{ picks: [0] }, { picks: [0] }]]]);
});
