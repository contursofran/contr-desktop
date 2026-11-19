import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { containsText, mountReply, replyBox, replyForm, sendError, statusLine } from "../../test/279-reply";

// docs/design/redesign/screens.html `.status` and chat-screen.html `.rf` and `.seg` (#230, #221).
// Chromium keeps alpha in 8 bits, so 0.586 reads 0.584.
const INK = {
  dark: { bright: "rgb(244, 244, 245)", dim: "rgba(255, 255, 255, 0.5)", detail: "rgba(255, 255, 255, 0.38)" },
  light: { bright: "rgb(20, 20, 20)", dim: "rgba(0, 0, 0, 0.584)", detail: "rgba(0, 0, 0, 0.584)" },
};

test("the status line, the model button and the switch are as the mock", async () => {
  await mountReply();
  const status = statusLine();
  await containsText(status).toContain("Hashing…35s · ↓ 1.2k tokens");
  const detail = status.getByText("35s · ↓ 1.2k tokens");
  const model = page.getByRole("button", { name: "Model" });
  await expect.element(model).toHaveTextContent("Opus 5.5medium");
  expect(model.element().querySelectorAll("svg")).toHaveLength(1);
  expect(model.element().querySelectorAll("[data-icon]")).toHaveLength(1);
  await expect.element(page.getByLabelText("Branch")).toHaveTextContent("main");

  await expect.element(status).toHaveStyle({ fontSize: "12px", columnGap: "10px", paddingLeft: "4px", paddingRight: "4px" });
  await expect.element(detail).toHaveStyle({ fontSize: "11px" });
  const orchestrating = status.getByText("Orchestrating · 3 workers");
  await expect.element(orchestrating).toHaveStyle({ fontSize: "12px" });

  // The switch is 52 px below the top of the work area, 14 px from its right, and 28 px high.
  const seg = page.getByRole("radiogroup", { name: "Chat or Terminal" });
  const main = page.getByRole("main").element().getBoundingClientRect();
  const box = seg.element().getBoundingClientRect();
  expect(box.y - main.y).toBe(52);
  expect(main.right - box.right).toBe(14);
  expect(box.height).toBe(28);

  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await expect.element(status.getByText("Hashing…")).toHaveStyle({ color: INK[scheme].dim });
    await expect.element(detail).toHaveStyle({ color: INK[scheme].detail });
    await expect.element(orchestrating).toHaveStyle({ color: INK[scheme].dim });
    await page.screenshot({ path: `../../../../tmp/shots/browser/status-reply-${scheme}.png` });
    const foot = page.elementLocator(status.element().parentElement!);
    await foot.screenshot({ path: `../../../../tmp/shots/browser/status-reply-foot-${scheme}.png` });
    await seg.screenshot({ path: `../../../../tmp/shots/browser/switch-${scheme}.png` });
  }
});

test("the context at 80% or more is bright ink, and a failed send is bright ink: red is only 'needs you'", async () => {
  await mountReply({
    info: { context: { percent: 80, text: "80%", warn: true } },
    sends: [{ ok: false, message: sendError }],
  });
  const context = page.getByLabelText("Context 80%");
  await expect.element(context).toHaveTextContent("80%");
  await replyBox().fill("one");
  await userEvent.keyboard("{Enter}");
  const alert = replyForm().getByRole("alert");
  await expect.element(alert).toHaveTextContent(`Not sent: ${sendError}`);
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await expect.element(context).toHaveStyle({ color: INK[scheme].bright });
    await expect.element(context.element().querySelector<SVGCircleElement>('circle[stroke="currentColor"]')).toHaveStyle({ stroke: INK[scheme].bright });
    await expect.element(alert).toHaveStyle({ color: INK[scheme].bright });
    await replyForm().screenshot({ path: `../../../../tmp/shots/browser/reply-context-warn-${scheme}.png` });
  }
});
