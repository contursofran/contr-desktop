import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { chatList, shoot } from "../../test/274-chat";
import { fixtureImageUrl, image } from "../../test/279-image";
import { deferred, mountReply, replyBox, replyForm, sendError } from "../../test/279-reply";

vi.mock("./chat/markdown/markdownLocalImages", async (importOriginal) => ({
  ...await importOriginal<typeof import("./chat/markdown/markdownLocalImages")>(),
  localImageUrl: (path: string) => fixtureImageUrl(path),
}));

const enter = () => userEvent.keyboard("{Enter}");

test("text typed during a slow send stays in the box; only the sent text leaves", async () => {
  const pending = deferred<{ ok: boolean }>();
  const { sent } = await mountReply({ sends: [pending.promise] });
  const box = replyBox();
  await box.fill("first message");
  await enter();
  await userEvent.keyboard("{End} typed-during-send");
  pending.resolve({ ok: true });
  await expect.poll(sent).toEqual(["first message"]);
  await expect.element(box).toHaveValue(" typed-during-send");
});

test("Enter during a slow send queues the next message: both go, in order, and a second Enter on the same text sends nothing", async () => {
  const pending = deferred<{ ok: boolean }>();
  const { sent } = await mountReply({ sends: [pending.promise] });
  const box = replyBox();
  await box.fill("one");
  await enter();
  await enter();
  await expect.element(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await box.fill("two");
  await enter();
  pending.resolve({ ok: true });
  await expect.poll(sent).toEqual(["one", "two"]);
  await expect.element(box).toHaveValue("");
});

test("an image attached during a slow send stays; the sent image leaves", async () => {
  const pending = deferred<{ ok: boolean }>();
  const { sent } = await mountReply({
    sends: [pending.promise],
    overrides: { pickImage: async () => ({ ok: true, path: image }) },
  });
  const box = replyBox();
  const pictures = page.getByRole("list", { name: "Attachments" }).getByRole("img");
  const attach = page.getByRole("button", { name: "Attach image" });
  await attach.click();
  await box.fill("look");
  await enter();
  await attach.click();
  await expect.element(pictures).toHaveLength(2);
  pending.resolve({ ok: true });
  await expect.poll(sent).toEqual([`look\n${image}`]);
  await expect.element(pictures).toHaveLength(1);
  await expect.element(box).toHaveValue("");
});

test("a failed send keeps its text and the text queued after it, which does not go", async () => {
  const pending = deferred<{ ok: boolean; message: string }>();
  const { sent } = await mountReply({ sends: [pending.promise] });
  const box = replyBox();
  await box.fill("one");
  await enter();
  await userEvent.keyboard("{End} two");
  await enter();
  pending.resolve({ ok: false, message: sendError });
  await expect.element(replyForm().getByRole("alert")).toHaveTextContent(`Not sent: ${sendError}`);
  // The queued draft becomes sendable again after the outbox skips it.
  await expect.element(page.getByRole("button", { name: "Send" })).toBeEnabled();
  await expect.element(box).toHaveValue("one two");
  expect(sent()).toEqual(["one"]);
});

test("while the first feed answer has not come, the chat shows the loader and 'Reading the chat…'", async () => {
  const { firstFeed } = await mountReply({ holdFeed: true });
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect.poll(() => loading.query()?.textContent).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]Reading the chat…$/);
  await expect.element(chatList().getByRole("listitem").first()).not.toBeInTheDocument();
  // The rest of the window is ready; only the feed is slow.
  await expect.element(page.getByRole("button", { name: "Model" })).toHaveTextContent("Opus 5.5medium");
  await expect.element(replyBox()).toHaveAccessibleName("Reply to Chat panel usability audit");
  await shoot("chat-loading");
  firstFeed();
  await expect.element(chatList().getByRole("listitem").first()).toBeVisible();
  await expect.element(loading).not.toBeInTheDocument();
});
