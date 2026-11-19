import { expect, test } from "vitest";
import { shoot } from "../../test/274-chat";
import { containsText, mountReply, projectNav, replyBox, statusLine } from "../../test/279-reply";

test("with no workers, Orchestrate puts /contr:orchestrate in the reply box and does not send", async () => {
  const { send } = await mountReply({ workers: false });
  const status = statusLine();
  const orchestrate = status.getByRole("button", { name: "Orchestrate" });
  await expect.element(orchestrate).toBeVisible();
  expect(status.element().textContent).not.toContain("Orchestrating");
  await shoot("orchestrate");

  await orchestrate.click();
  const box = replyBox();
  await expect.element(box).toHaveValue("/contr:orchestrate ");
  await expect.element(box).toHaveFocus();
  const el = box.element() as HTMLTextAreaElement;
  expect([el.selectionStart, el.selectionEnd]).toEqual([19, 19]);
  expect(send).not.toHaveBeenCalled();
});

test("with workers, the status line says Orchestrating and has no Orchestrate", async () => {
  await mountReply();
  const status = statusLine();
  await containsText(status).toContain("Orchestrating · 3 workers");
  const desktop = projectNav().getByRole("region", { name: "contr-desktop" });
  for (const name of ["b-30", "b-40", "b-50"]) {
    await expect.element(desktop.getByText(name, { exact: true })).toBeVisible();
  }
  await expect.element(status.getByRole("button", { name: "Orchestrate" })).not.toBeInTheDocument();
  await shoot("orchestrating");
});
