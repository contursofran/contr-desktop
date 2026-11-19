import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import bashPermission from "../../e2e/fixtures/cards/bash-permission.json";
import { chatList, shoot } from "../../test/274-chat";
import { agentRow, containsText, mountReply, replyBox } from "../../test/279-reply";

const activate = () => window.dispatchEvent(new FocusEvent("focus"));
const blur = () => (document.activeElement as HTMLElement | null)?.blur();
const notes = () => agentRow(/Release notes draft/);
const loading = () => page.getByRole("status", { name: "Reading the chat" });

test("the reply box takes the keyboard at start, on another agent's chat, back from Terminal, and when the window becomes active", async () => {
  await mountReply();
  await expect.element(replyBox()).toHaveAccessibleName("Reply to Chat panel usability audit");
  await expect.element(replyBox()).toHaveFocus();

  await notes().click();
  await expect.element(replyBox()).toHaveAccessibleName("Reply to Release notes draft");
  await expect.element(replyBox()).toHaveFocus();

  await page.getByRole("radio", { name: "Terminal", exact: true }).click();
  await expect.element(replyBox()).not.toBeInTheDocument();
  await page.getByRole("radio", { name: "Chat", exact: true }).click();
  await expect.element(replyBox()).toHaveFocus();

  (await notes().findElement() as HTMLElement).focus();
  activate();
  await expect.element(replyBox()).toHaveFocus();
  blur();
  activate();
  await expect.element(replyBox()).toHaveFocus();
  await userEvent.keyboard("12");
  await expect.element(replyBox()).toHaveValue("12");
});

test("the reply box does not take the keyboard from a selection in the chat or an open menu", async () => {
  await mountReply();
  await expect.element(replyBox()).toHaveFocus();

  const first = chatList().getByRole("listitem").first();
  await expect.element(first).toBeVisible();
  blur();
  document.getSelection()?.selectAllChildren(first.element());
  const selected = () => document.getSelection()?.toString() ?? "";
  const text = selected();
  expect(text).not.toBe("");
  activate();
  await expect.element(replyBox()).not.toHaveFocus();
  expect(selected()).toBe(text);

  document.getSelection()?.removeAllRanges();
  await page.getByRole("button", { name: "Model" }).click();
  const menu = page.getByRole("menu", { name: "Model" });
  await expect.element(menu).toBeVisible();
  await expect.element(replyBox()).not.toHaveFocus();
  activate();
  await expect.element(menu).toBeVisible();
  await expect.element(replyBox()).not.toHaveFocus();
});

test("with a card that owns the card keys, the reply box leaves the keyboard: a 1 answers the card", async () => {
  await mountReply({
    card: { ...bashPermission, kind: "approval", answered: false },
    overrides: { approve: async () => ({ result: "sent" }) },
  });
  const card = page.getByRole("region", { name: "Approval" });
  await expect.element(card).toBeVisible();
  activate();
  await expect.element(replyBox()).not.toHaveFocus();
  await userEvent.keyboard("1");
  await containsText(card).toContain("Answer sent. Waiting for the agent.");
  await expect.element(replyBox()).toHaveValue("");
});

test("a late first answer leaves the focus on a button that took it while the chat was read", async () => {
  // Keep the two replies in view so this test observes focus without relying on virtual scrolling.
  const { firstFeed, append } = await mountReply({
    holdFeed: true,
    initialRows: [{ id: "first", k: "assistant", text: "First reply." }],
  });
  await expect.element(loading()).toBeVisible();
  const attach = page.getByRole("button", { name: "Attach image" });
  (await attach.findElement() as HTMLElement).focus();
  await expect.element(loading()).toBeVisible();
  firstFeed();
  await expect.element(loading()).not.toBeInTheDocument();
  await containsText(chatList()).toContain("First reply.");
  await expect.element(attach).toHaveFocus();
  append({ id: "late", k: "assistant", ts: 1793671080000, text: "Next tick." });
  await containsText(chatList()).toContain("Next tick.");
  await expect.element(attach).toHaveFocus();
  await expect.element(replyBox()).not.toHaveFocus();
  await shoot("focus-late-button");
});

test("the first answer gives the keyboard to the reply box when the page body has focus", async () => {
  const { firstFeed } = await mountReply({ holdFeed: true });
  await expect.element(loading()).toBeVisible();
  expect(document.activeElement).toBe(document.body);
  firstFeed();
  await expect.element(loading()).not.toBeInTheDocument();
  await expect.element(replyBox()).toHaveFocus();
});

test("the first answer gives the reply box focus after the owner selects an agent in the sidebar", async () => {
  const { firstFeed } = await mountReply({ holdFeed: true });
  await notes().click();
  await expect.element(replyBox()).toHaveAccessibleName("Reply to Release notes draft");
  await expect.element(loading()).toBeVisible();
  await expect.element(notes()).toHaveFocus();
  firstFeed();
  await expect.element(replyBox()).toHaveFocus();
});

test.each(["tab", "sidebar button"] as const)(
  "the first answer leaves focus on the %s after the window becomes active",
  async (control) => {
    const { firstFeed } = await mountReply({ holdFeed: true });
    await expect.element(loading()).toBeVisible();
    const target = control === "tab"
      ? page.getByRole("tab", { name: "Chat panel usability audit" })
      : notes();
    (await target.findElement() as HTMLElement).focus();
    activate();
    await expect.element(target).toHaveFocus();
    firstFeed();
    await expect.element(loading()).not.toBeInTheDocument();
    await expect.element(target).toHaveFocus();
  },
);
