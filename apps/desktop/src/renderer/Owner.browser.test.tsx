import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { normalizedText } from "../../test/273-chatRows";
import { blur, ownerFake, renderCards, shoot, textOf } from "../../test/280-browser";

test("answering a question and completing a to-do shows the next items", async () => {
  const owner = ownerFake();
  await renderCards(null, owner.api);
  const q = page.getByRole("region", { name: "Owner question" });
  const t = page.getByRole("region", { name: "Owner to-do" });
  await expect.poll(() => textOf(q)).toMatch(/D7 · The coordinator asks · Inbox order · from b-15 · 1 more after this/);
  await expect.poll(() => textOf(q)).toMatch(/Which items show first in the inbox\?/);
  expect(q.getByRole("radio").filter({ hasText: /first/ }).elements().map(normalizedText)).toEqual([
    "1Oldest first · recommendedMatches the design; nothing waits forever.",
    "2Newest firstNew work shows at once; old items wait.",
  ]);
  await expect.poll(() => textOf(q)).toMatch(/Refs#15docs\/design\/recipe-herdr\.md/);
  await expect.poll(() => textOf(q)).not.toMatch(/Not for this chat\./);
  await expect.element(t).toHaveTextContent("T3Log in to the staging server, then run pnpm e2e in apps/desktop.To do · from b-15 · 3 commandsShowDone");
  expect(t.element().querySelector("strong")?.textContent).toBe("staging");
  const copies = t.getByRole("button", { name: /^Copy / });
  expect(copies.elements()).toHaveLength(0);
  await t.getByRole("button", { name: "Show" }).click();
  await expect.element(t.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => copies.elements().length).toBe(3);
  await expect.element(t.getByRole("button", { name: "Copy CONTR_E2E=1 pnpm e2e --repeat-each 3" })).toBeVisible();
  await shoot("owner-cards");

  await q.getByRole("radio", { name: "Oldest first · recommended", exact: true }).click();
  await expect.poll(() => textOf(q)).toMatch(/D8 · The coordinator asks/);
  await expect.poll(() => textOf(q)).not.toMatch(/more after this/);
  await t.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => textOf(t)).toMatch(/T4The CI cache is now keyed on the lockfile\.To know · from b-16/);
  await expect.poll(() => textOf(t)).toMatch(/The CI cache is now keyed on the lockfile\./);
  expect(owner.ownerAnswer.mock.calls).toEqual([["D7", "Oldest first"]]);
  expect(owner.ownerDone.mock.calls).toEqual([["T3"]]);
});

test.each(["chat", "Inbox"])("the %s owner question sends the recommended pick with Enter and holds digits in Own answer", async (place) => {
  const owner = ownerFake();
  await renderCards(null, owner.api);
  if (place === "Inbox") {
    await page.getByRole("button", { name: /^Inbox/ }).click();
  }
  const q = page.getByRole("region", { name: "Owner question" });
  await expect.element(q.getByRole("button", { name: "Send answer" })).toBeEnabled();
  const group = q.getByRole("radiogroup", { name: "Which items show first in the inbox?" });
  await expect.element(group.getByRole("radio", { name: "Oldest first · recommended", exact: true })).toBeChecked();
  blur();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => textOf(q)).toMatch(/Does the Dock badge count to-dos\?/);
  expect(owner.ownerAnswer.mock.calls).toEqual([["D7", "Oldest first"]]);

  const own = q.getByRole("textbox", { name: "Own answer" });
  await userEvent.keyboard("3");
  await expect.element(own).toHaveFocus();
  await userEvent.keyboard("2");
  await expect.element(own).toHaveValue("2");
  await expect.element(q.getByRole("radio", { checked: true })).not.toBeInTheDocument();
  await own.clear();
  await expect.element(q.getByRole("radio", { name: "Yes · recommended", exact: true })).toBeChecked();
  await userEvent.keyboard("2{Enter}");
  await expect.poll(() => owner.ownerAnswer.mock.calls).toEqual([["D7", "Oldest first"], ["D8", "2"]]);
});
