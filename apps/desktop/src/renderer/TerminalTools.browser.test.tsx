import { expect, onTestFinished, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { css, shot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";
import type { TerminalApi } from "../shared/api";

const modifier = navigator.platform.startsWith("Mac") ? "Meta" : "Control";
const url = "https://example.com/build";
const oscUrl = "https://example.com/report";

async function openTerminal(output: (cols: number) => string, readyText = "Build") {
  let write: Parameters<TerminalApi["onData"]>[0];
  const input = vi.fn();
  await renderApp(transcript, null, {
    terminal: {
      attach: async (cols) => {
        write(new TextEncoder().encode(output(cols)));
        return { terminal: "t7" };
      },
      input,
      resize() {},
      onData(listener) { write = listener; return () => {}; },
      onEnd() { return () => {}; },
    },
  });
  await page.getByRole("radio", { name: "Terminal" }).click();
  const host = page.getByTestId("terminal");
  await expect.poll(() => host.query()?.querySelector(".xterm-rows")?.textContent).toContain(readyText);
  const textarea = css(".xterm-helper-textarea", host);
  return { host, textarea, field: page.elementLocator(textarea), input };
}

test("opens detected and OSC 8 links only with the platform modifier", async () => {
  const { host } = await openTerminal(() =>
    `Build ${url}\r\n\x1b]8;;${oscUrl}\x07Report\x1b]8;;\x07\r\n\x1b]8;;file:///report\x07Local\x1b]8;;\x07`);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  onTestFinished(() => { open.mockRestore(); });
  const rows = css(".xterm-rows", host);
  function clickLink(row: number, offset: number, modified: boolean) {
    const { left, top, height } = rows.children[row]!.getBoundingClientRect();
    const options = {
      bubbles: true, clientX: left + offset, clientY: top + height / 2,
      metaKey: modified && modifier === "Meta", ctrlKey: modified && modifier === "Control",
    };
    for (const type of ["mousemove", "mousedown", "mouseup"]) {
      rows.dispatchEvent(new MouseEvent(type, options));
    }
  }
  clickLink(0, 65, false);
  clickLink(1, 10, false);
  expect(open).not.toHaveBeenCalled();
  clickLink(0, 65, true);
  clickLink(1, 10, true);
  clickLink(2, 10, true);
  expect(open.mock.calls).toEqual([[url, "_blank", "noopener"], [oscUrl, "_blank", "noopener"]]);
});

test("copies a selection and sends each bracketed paste once", async () => {
  const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
  const read = vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("three\nfour");
  onTestFinished(() => { read.mockRestore(); platform.mockRestore(); });
  const { host, textarea, field, input } = await openTerminal(() => "\x1b[?2004hBuild ready");
  const rows = css(".xterm-rows", host);
  const { left, top, height } = rows.firstElementChild!.getBoundingClientRect();
  rows.dispatchEvent(new MouseEvent("mousedown", {
    bubbles: true, detail: 2, clientX: left + 10, clientY: top + height / 2,
  }));
  const copied = new DataTransfer();
  textarea.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: copied }));
  expect(copied.getData("text/plain")).toBe("Build");
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", "one\ntwo");
  textarea.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
  expect(input).toHaveBeenCalledExactlyOnceWith("\x1b[200~one\rtwo\x1b[201~");
  await expect.element(field).toHaveFocus();
  await userEvent.keyboard("{Control>}{Shift>}v{/Shift}{/Control}");
  expect(input.mock.calls).toEqual([["\x1b[200~one\rtwo\x1b[201~"], ["\x1b[200~three\rfour\x1b[201~"]]);
});

// Adapt the wrapped-line case from generalaction/emdash
// apps/emdash-desktop/src/core/features/terminals/browser/pty/terminal-search.ts
// at 9e2942b8281b17703c0e66845080a556ae262677. Run it through SearchAddon in the real terminal.
test("finds wrapped output, moves through matches and returns focus on Escape", async () => {
  const { field, input } = await openTerminal((cols) =>
    `Build ready\r\nport active\r\nport closed\r\n\r\n${" ".repeat(cols - 2)}port idle`);
  await userEvent.keyboard(`{${modifier}>}f{/${modifier}}`);
  const find = page.getByRole("textbox", { name: "Find in terminal" });
  const count = page.getByLabelText("Match count");
  await expect.element(find).toHaveFocus();
  await find.fill("port");
  await expect.element(count).toHaveTextContent("1 of 3");
  await userEvent.keyboard("{Enter}");
  await expect.element(count).toHaveTextContent("2 of 3");
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  await expect.element(count).toHaveTextContent("1 of 3");
  await page.getByRole("button", { name: "Previous match" }).click();
  await expect.element(count).toHaveTextContent("3 of 3");
  await page.getByRole("button", { name: "Next match" }).click();
  await expect.element(count).toHaveTextContent("1 of 3");
  expect(input).not.toHaveBeenCalled();

  await find.fill("absent");
  await expect.element(count).toHaveTextContent("0");
  await userEvent.keyboard("{Escape}");
  await expect.element(find).not.toBeInTheDocument();
  await expect.element(field).toHaveFocus();
});

test("shows search highlights for dev server output in both themes", async () => {
  const output = [
    "~/code/contr-desktop main $ pnpm dev",
    "$ pnpm --filter desktop dev",
    "$ node scripts/dev.mjs",
    "",
    "  VITE v8.3.8  ready in 183 ms",
    "",
    "  ➜  Local:   http://localhost:5173/",
    "  ➜  Network: use --host to expose",
    "[electron] Loading renderer from http://localhost:5173/",
    "[electron] Renderer ready on port 5173",
  ].join("\r\n");
  const { host } = await openTerminal(() => output, "Renderer ready on port 5173");
  await userEvent.keyboard(`{${modifier}>}f{/${modifier}}`);
  await page.getByRole("textbox", { name: "Find in terminal" }).fill("5173");
  await expect.element(page.getByLabelText("Match count")).toHaveTextContent("1 of 3");

  for (const [scheme, color] of [["dark", "rgb(233, 233, 234)"], ["light", "rgb(30, 30, 30)"]] as const) {
    await commands.colorScheme(scheme);
    await expect.poll(() => Array.from(host.element().querySelectorAll(".xterm-decoration"))
      .map((el) => getComputedStyle(el).outlineColor)).toContain(color);
    await shot(`terminal-find-${scheme}`);
  }
});
