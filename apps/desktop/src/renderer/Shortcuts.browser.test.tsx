import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { browserShots } from "../../test/273-chatRows";
import { mountReply, projectNav, replyBox } from "../../test/279-reply";
import type { TerminalApi } from "../shared/api";

const tab = (name: string) => page.getByRole("tab", { name, exact: true });
const shown = () => page.getByRole("tab", { selected: true });
const terminal = () => page.getByTestId("terminal");
const terminalInput = () => terminal().getByRole("textbox");
const chat = () => page.getByRole("radio", { name: "Chat", exact: true });
const audit = "Chat panel usability audit";
const worker = "Install health check";
const next = "{Meta>}{Alt>}{ArrowDown}{/Alt}{/Meta}";
const previous = "{Meta>}{Alt>}{ArrowUp}{/Alt}{/Meta}";
const toggle = "{Meta>}j{/Meta}";
const close = "{Meta>}w{/Meta}";

function fakeTerminal() {
  let write: Parameters<TerminalApi["onData"]>[0] | undefined;
  return {
    webgl: false,
    async attach() {
      write?.(new TextEncoder().encode("fake terminal t7 attached\r\n"));
      return { terminal: "t7" };
    },
    input: vi.fn(),
    resize() {},
    onData(listener) {
      write = listener;
      return () => { write = undefined; };
    },
    onEnd: () => () => {},
  } satisfies TerminalApi;
}

test("Command+J switches from reply to terminal input and back to reply", async () => {
  const api = fakeTerminal();
  await mountReply({ overrides: { terminal: api } });
  await expect.element(replyBox()).toHaveFocus();

  await userEvent.keyboard(toggle);
  await expect.element(page.getByRole("radio", { name: "Terminal" })).toBeChecked();
  await expect.element(terminalInput()).toHaveFocus();
  await expect.element(terminal().getByText("fake terminal t7 attached")).toBeVisible();
  await page.screenshot({ path: `${browserShots}/170-terminal-shortcut.png` });

  await userEvent.keyboard(toggle);
  await expect.element(chat()).toBeChecked();
  await expect.element(replyBox()).toHaveFocus();
  expect(api.input).not.toHaveBeenCalled();
});

test("Command+Option+Up and Down follow sidebar order, including workers", async () => {
  await mountReply();
  await expect.element(replyBox()).toHaveFocus();
  const nav = projectNav();
  (await shown().findElement()).focus();
  await userEvent.keyboard(previous);
  await expect.element(shown()).toHaveTextContent(audit);
  await userEvent.keyboard(next);
  await expect.element(shown()).toHaveTextContent(worker);
  await expect.element(nav.getByRole("button", { name: new RegExp(worker) })).toHaveAttribute("aria-current", "true");
  await expect.element(replyBox()).toHaveFocus();
  (await shown().findElement()).focus();
  await userEvent.keyboard(previous);
  await expect.element(shown()).toHaveTextContent(audit);
});

test("both arrow shortcuts leave the reply and other editors in control", async ({ onTestFinished }) => {
  await mountReply();
  await projectNav().getByRole("button", { name: new RegExp(worker) }).click();
  await expect.element(shown()).toHaveTextContent(worker);
  await expect.element(replyBox()).toHaveFocus();
  const select = vi.spyOn(window.contr, "select");
  await userEvent.keyboard("draft");
  const input = document.createElement("input");
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  document.body.append(input, editor);
  onTestFinished(() => { input.remove(); editor.remove(); });

  for (const field of [replyBox().element(), input, editor]) {
    (field as HTMLElement).focus();
    for (const chord of [previous, next]) {
      await userEvent.keyboard(chord);
      expect(select).not.toHaveBeenCalled();
      await expect.element(field).toHaveFocus();
      await expect.element(shown()).toHaveTextContent(worker);
    }
  }
  await expect.element(replyBox()).toHaveValue("draft");
});

test("terminal input keeps its keys and Command+W still closes the tab", async () => {
  const api = fakeTerminal();
  await mountReply({ overrides: { terminal: api } });
  await expect.element(replyBox()).toHaveFocus();
  await userEvent.keyboard(toggle);
  await expect.element(terminalInput()).toHaveFocus();
  const select = vi.spyOn(window.contr, "select");
  await userEvent.keyboard(next);
  await userEvent.keyboard(previous);
  expect(select).not.toHaveBeenCalled();
  await userEvent.keyboard("x");
  expect(api.input).toHaveBeenLastCalledWith("x");
  await expect.element(shown()).toHaveTextContent(audit);
  await expect.element(terminalInput()).toHaveFocus();
  await userEvent.keyboard(close);
  await expect.element(tab(audit)).not.toBeInTheDocument();
  await expect.element(terminal()).not.toBeInTheDocument();
});

test("Command+W closes the shown tab from the reply and does nothing in the Inbox", async () => {
  await mountReply();
  await projectNav().getByRole("button", { name: new RegExp(worker) }).click();
  await expect.element(replyBox()).toHaveAccessibleName(`Reply to ${worker}`);
  await expect.element(replyBox()).toHaveFocus();
  await userEvent.keyboard(close);
  await expect.element(tab(worker)).not.toBeInTheDocument();
  await expect.element(shown()).toHaveTextContent(audit);
  await expect.element(replyBox()).toHaveFocus();
  await projectNav().getByRole("button", { name: /^Inbox/ }).click();
  await userEvent.keyboard(close);
  await userEvent.keyboard(toggle);
  await userEvent.keyboard(next);
  await expect.element(tab(audit)).toBeVisible();
  await expect.element(shown()).not.toBeInTheDocument();
  await expect.element(chat()).not.toBeInTheDocument();
});
