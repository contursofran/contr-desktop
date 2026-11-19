import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import { chatList, chatSettled, shoot } from "../../test/274-chat";
import { contrFake } from "../../test/contrFake";
import { renderApp } from "../../test/renderApp";

const question = "Question 0: Is the chat ready for review?";
const rows = [question, ...Array.from({ length: 22 }, (_, i) => `Question ${i + 1}: Review the chat layout.`)]
  .map((text, i) => JSON.stringify({ id: `q${i}`, k: "user", text, ts: 1793670000000 + i * 1000 }))
  .join("\n");

const reply = page.getByRole("form", { name: "Reply" });
const model = reply.getByRole("button", { name: "Model", exact: true });
const viewSwitch = page.getByRole("radiogroup", { name: "Chat or Terminal" });

function textBounds(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect();
}

test("the default Claude worker shows Opus 5.5 and labeled model choices", async () => {
  await renderApp(rows);
  await expect.element(model.getByText("Opus 5.5", { exact: true })).toBeVisible();
  await model.click();
  for (const name of ["Opus 5.5", "Sonnet 5.5", "Haiku 5.5"]) {
    await expect.element(page.getByRole("menuitemradio", { name, exact: true })).toBeVisible();
  }
});

test("the first chat row clears the switch and fades out when scrolled under it", async () => {
  await renderApp(rows);
  await page.viewport(640, 480);
  const list = await chatList().findElement();
  const control = await viewSwitch.findElement() as HTMLElement;
  await chatSettled(list);
  list.scrollTo({ top: 0 });
  const first = await chatList().getByText(question, { exact: true }).findElement();
  await chatSettled(list);

  const button = control.getBoundingClientRect();
  const start = textBounds(first);
  expect(start.top).toBeGreaterThanOrEqual(button.bottom);
  const x = Math.max(start.left, button.left) + 4;
  expect(x).toBeLessThan(Math.min(start.right, button.right));
  expect(first.contains(document.elementFromPoint(x, start.top + 2))).toBe(true);

  // Move the text behind the switch. Hide the switch for the hit test so it cannot intercept the point.
  const y = button.bottom - 4;
  list.scrollTo({ top: start.top - y + 2 });
  await chatSettled(list);
  const scrolled = textBounds(first);
  expect(scrolled.top).toBeLessThan(y);
  expect(scrolled.bottom).toBeGreaterThan(y);
  control.style.visibility = "hidden";
  try {
    expect(first.contains(document.elementFromPoint(x, y))).toBe(false);
  } finally {
    control.style.visibility = "";
  }

  list.scrollTo({ top: 0 });
  await chatSettled(list);
  await expect.element(model.getByText("Opus 5.5", { exact: true })).toBeVisible();
  await expect.element(reply.getByLabelText("Branch")).toHaveTextContent("main");
  await document.fonts.ready;
  await shoot("297-chat-layout");
});

test("the reply footer fits main at the minimum window width in both themes", async () => {
  const info = await contrFake([], null).replyInfo();
  await renderApp(rows, null, {
    replyInfo: async () => ({ ...info, models: [], tier: "fast", speed: "58 tok/s" }),
  });
  await page.viewport(640, 480);
  await model.getByText("claude-opus-5-5", { exact: true }).findElement();
  const branch = await reply.getByLabelText("Branch").findElement() as HTMLElement;
  const send = await reply.getByRole("button", { name: "Send", exact: true }).findElement();
  await document.fonts.ready;
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    expect(branch.textContent).toBe("main");
    expect(branch.scrollWidth, scheme).toBeLessThanOrEqual(branch.clientWidth);
    expect(send.getBoundingClientRect().right).toBeLessThan(reply.element().getBoundingClientRect().right);
  }
});
