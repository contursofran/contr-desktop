import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { css, shoot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";
import type { TerminalApi } from "../shared/api";

function terminalFake() {
  let data: Parameters<TerminalApi["onData"]>[0] | undefined;
  const write = (text: string) => data?.(new TextEncoder().encode(text));
  const api = {
    attach: vi.fn(async () => {
      write("fake terminal t7 attached\r\n");
      return { terminal: "t7" };
    }),
    input() {},
    resize: vi.fn<TerminalApi["resize"]>(),
    onData(listener) {
      data = listener;
      return () => { data = undefined; };
    },
    onEnd: () => () => {},
  } satisfies TerminalApi;
  return { api, write };
}

test("the initial fit and later grids in xterm match the sizes sent to hc", async ({ onTestFinished }) => {
  const open = vi.spyOn(Terminal.prototype, "open");
  const activate = vi.spyOn(WebglAddon.prototype, "activate").mockImplementation(() => {
    throw new Error("WebGL unavailable");
  });
  onTestFinished(() => {
    activate.mockRestore();
    open.mockRestore();
  });
  const { api } = terminalFake();
  await page.viewport(1200, 800);
  await renderApp(transcript, null, { terminal: api });
  await page.getByRole("radio", { name: "Terminal" }).click();
  await expect.poll(() => api.attach.mock.calls.length).toBe(1);
  const term = open.mock.contexts[0] as Terminal;
  const grid = () => [term.cols, term.rows] as const;
  const initial = grid();
  expect(api.attach).toHaveBeenCalledExactlyOnceWith(...initial);
  expect(api.resize).not.toHaveBeenCalled();

  await page.viewport(1000, 700);
  await expect.poll(() => term.cols).toBeLessThan(initial[0]);
  expect(api.resize).toHaveBeenLastCalledWith(...grid());
  const first = grid();

  await page.viewport(820, 580);
  await expect.poll(() => term.cols).toBeLessThan(first[0]);
  expect(api.resize).toHaveBeenLastCalledWith(...grid());
  expect(api.resize.mock.calls).toEqual([first, grid()]);
});

test("a lost WebGL context restores DOM output and keeps it on reopen", async ({ onTestFinished }) => {
  const activate = vi.spyOn(WebglAddon.prototype, "activate");
  onTestFinished(() => activate.mockRestore());
  const { api, write } = terminalFake();
  await renderApp(transcript, null, { terminal: api });
  await page.viewport(900, 600);
  await page.getByRole("radio", { name: "Terminal" }).click();
  const host = page.getByTestId("terminal");
  await expect.poll(() => activate.mock.calls.length).toBe(1);
  await expect.poll(() => host.query()?.querySelector(".xterm-rows") ?? null).toBeNull();
  const canvas = css(".xterm-screen canvas:last-child", host);
  expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  await expect.poll(() => host.query()?.textContent, { timeout: 6000 }).toContain("fake terminal t7 attached");
  write("hc output after context loss\r\n");
  await expect.poll(() => host.query()?.textContent).toContain("hc output after context loss");
  await shoot("291-terminal-fallback");

  await page.getByRole("radio", { name: "Chat" }).click();
  await page.getByRole("radio", { name: "Terminal" }).click();
  await expect.poll(() => host.query()?.textContent).toContain("fake terminal t7 attached");
  await new Promise(requestAnimationFrame);
  expect(activate).toHaveBeenCalledOnce();
});
