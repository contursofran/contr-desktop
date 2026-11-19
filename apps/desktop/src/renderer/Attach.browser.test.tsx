import { expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { fixtureImageUrl, gone, image, notesFile } from "../../test/279-image";
import { agentRow, containsText, mountReply, paste, replyBox, replyForm } from "../../test/279-reply";

vi.mock("./chat/markdown/markdownLocalImages", async (importOriginal) => ({
  ...await importOriginal<typeof import("./chat/markdown/markdownLocalImages")>(),
  localImageUrl: (path: string) => fixtureImageUrl(path),
}));

const attachments = () => page.getByRole("list", { name: "Attachments" });
const attach = () => page.getByRole("button", { name: "Attach image" });
const pick = async () => ({ ok: true, path: image });

async function shootReply(name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await replyForm().screenshot({ path: `../../../../tmp/shots/browser/${name}-${scheme}.png` });
  }
}

test("the + button attaches the picked image as a picture with a × and sends its path", async () => {
  const { calls } = await mountReply({ overrides: { pickImage: pick } });
  const box = replyBox();
  await attach().click();
  const picture = attachments().getByRole("img", { name: "shot.png" });
  await expect.element(picture).toHaveStyle({ height: "56px", borderTopLeftRadius: "8px", borderTopWidth: "1px" });
  // Electron still checks that the local image protocol loads the file.
  await expect.element(attachments().getByRole("button", { name: "Remove shot.png" })).toBeVisible();
  await box.fill("look");
  await box.hover();
  await containsText(page.getByRole("button", { name: "Model" })).toContain("Opus 5.5");
  await shootReply("attach");
  await userEvent.keyboard("{Enter}");
  await expect.element(box).toHaveValue("");
  await expect.element(attachments()).not.toBeInTheDocument();
  expect(calls).toEqual([{ terminal: "t7", text: `look\n${image}` }]);
});

test("the × removes one attachment with Enter or Space, files stay with their agent, and only the rest is sent", async () => {
  const { calls } = await mountReply({ overrides: { pickImage: pick, pasteImage: async () => ({ ok: true, path: notesFile }) } });
  const box = replyBox();
  const items = attachments().getByRole("listitem");
  await attach().click();
  await expect.element(items).toHaveLength(1);
  await attach().click();
  await expect.element(items).toHaveLength(2);
  await paste("image/png");
  await expect.element(items).toHaveLength(3);
  await expect.element(items.nth(2)).toHaveTextContent("claude-session.jsonl");
  await expect.element(items.nth(2).getByRole("button", { name: "Remove claude-session.jsonl" })).toBeVisible();
  await expect.element(attachments().getByRole("img", { name: "shot.png" })).toHaveLength(2);
  await box.fill("two files");
  await shootReply("attach-three");

  await agentRow(/Release notes draft/).click();
  await expect.element(page.getByRole("textbox", { name: "Reply to Release notes draft" })).toHaveValue("");
  await expect.element(attachments()).not.toBeInTheDocument();
  await agentRow(/Chat panel usability audit/).click();
  await expect.element(items).toHaveLength(3);

  (await box.findElement() as HTMLElement).focus();
  await userEvent.tab({ shift: true });
  const removeNotes = page.getByRole("button", { name: "Remove claude-session.jsonl" });
  await expect.element(removeNotes).toHaveFocus();
  await userEvent.tab({ shift: true });
  await userEvent.tab({ shift: true });
  await expect.element(attachments().getByRole("button", { name: "Remove shot.png" }).first()).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(items).toHaveLength(2);
  await expect.element(box).toHaveFocus();
  await expect.element(box).toHaveValue("two files");
  await userEvent.tab({ shift: true });
  await expect.element(removeNotes).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect.element(items).toHaveLength(1);
  await expect.element(box).toHaveValue("two files");

  await page.getByRole("button", { name: "Send" }).click();
  await expect.element(box).toHaveValue("");
  expect(calls).toEqual([{ terminal: "t7", text: `two files\n${image}` }]);
});

test("a pasted picture is a picture, a picture that does not load is a chip, text pastes as text, and pictures alone can be sent", async () => {
  const pasteImage = vi.fn(async () => ({ ok: true, path: image }));
  const { calls } = await mountReply({ overrides: { pasteImage, pickImage: async () => ({ ok: true, path: gone }) } });
  const box = replyBox();
  const items = attachments().getByRole("listitem");
  (await box.findElement() as HTMLElement).focus();
  expect(await paste("text/plain")).toBe(true);
  expect(pasteImage).not.toHaveBeenCalled();
  await paste("image/png");
  await expect.element(items).toHaveLength(1);
  const picture = items.getByRole("img", { name: "shot.png" });
  await expect.poll(() => {
    const img = picture.query() as HTMLImageElement | null;
    return img?.complete && img.naturalWidth > 0;
  }).toBe(true);

  await attach().click();
  await expect.element(items).toHaveLength(2);
  await expect.element(items.nth(1)).toHaveTextContent("gone.png");
  await expect.element(items.nth(1)).toHaveAttribute("title", gone);
  await expect.element(items.nth(1).getByRole("img")).not.toBeInTheDocument();
  await expect.element(items.nth(1).getByRole("button", { name: "Remove gone.png" })).toBeVisible();

  await expect.element(box).toHaveValue("");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.element(items.first()).not.toBeInTheDocument();
  expect(calls).toEqual([{ terminal: "t7", text: `${image}\n${gone}` }]);
});
