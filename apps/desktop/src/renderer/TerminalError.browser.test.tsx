import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import { css, shoot, transcript } from "../../test/281-shell";
import { sidebar } from "../../test/275-sidebar";
import { renderApp } from "../../test/renderApp";
import type { Sidebar, TerminalApi } from "../shared/api";

function terminalFake() {
  let data: Parameters<TerminalApi["onData"]>[0] | undefined;
  let end: Parameters<TerminalApi["onEnd"]>[0] | undefined;
  const attach = vi.fn<TerminalApi["attach"]>();
  const api: TerminalApi = {
    attach,
    input() {},
    resize() {},
    onData(listener) {
      data = listener;
      return () => { data = undefined; };
    },
    onEnd(listener) {
      end = listener;
      return () => { end = undefined; };
    },
  };
  return {
    api, attach,
    end: (reason: string) => end?.(reason),
    write: (text: string) => data?.(new TextEncoder().encode(text)),
  };
}

test("a terminal connection that ends shows hc's words, and Retry opens the terminal again", async () => {
  const terminal = terminalFake();
  const reason = "hc closed the connection: fake hc: the core is not running";
  terminal.attach.mockImplementationOnce(async () => {
    terminal.end(reason);
    return { terminal: "t7" };
  }).mockImplementationOnce(async () => {
    terminal.write("fake terminal t7 attached\r\n");
    return { terminal: "t7" };
  });
  await renderApp(transcript, null, { terminal: terminal.api });
  await page.viewport(900, 600);
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect.element(note).toBeVisible();
  const problem = css("p", note);
  const detail = css("pre", note);
  expect(problem.textContent).toBe("The connection to hc ended.");
  expect(detail.textContent).toBe(reason);
  await expect.element(note).toHaveStyle({ borderTopWidth: "0px", maxWidth: "520px" });
  await expect.poll(() => getComputedStyle(detail).fontFamily).toMatch(/JetBrains Mono/);
  await expect.element(page.elementLocator(detail)).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0)" });
  for (const [scheme, text, dim] of [
    ["dark", "rgb(244, 244, 245)", "rgba(255, 255, 255, 0.5)"],
    ["light", "rgb(20, 20, 20)", "rgba(0, 0, 0, 0.584)"],
  ] as const) {
    await commands.colorScheme(scheme);
    await expect.element(page.elementLocator(problem)).toHaveStyle({ color: text });
    await expect.element(page.elementLocator(detail)).toHaveStyle({ color: dim });
  }
  await shoot("terminal-error");

  await note.getByRole("button", { name: "Retry" }).click();
  const host = page.getByTestId("terminal");
  await expect.element(note).not.toBeInTheDocument();
  await expect.poll(() => host.query()?.textContent).toMatch(/fake terminal t7 attached/);
  expect(terminal.attach).toHaveBeenCalledTimes(2);
  const lines = css(".xterm-rows", host);
  expect(getComputedStyle(host.element().parentElement!).padding).toBe("16px 24px 18px");
  await expect.poll(() => getComputedStyle(lines).fontFamily).toMatch(/JetBrains Mono/);
  await expect.element(page.elementLocator(lines)).toHaveStyle({ fontSize: "13px" });
  await expect.element(page.elementLocator(lines.firstElementChild!)).toHaveStyle({ height: "20px" });
  await shoot("terminal-attached");
});

test("an unreadable hc hello shows a plain note", async () => {
  const terminal = terminalFake();
  terminal.attach.mockResolvedValue({ error: "hc sent data that is not JSON" });
  await renderApp(transcript, null, { terminal: terminal.api });
  await page.viewport(900, 600);
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect.poll(() => css("p", note)?.textContent).toBe("hc sent data that contr cannot read.");
  await expect.poll(() => css("pre", note)?.textContent).toBe("hc sent data that is not JSON");
  await shoot("terminal-not-json");
});

test("the sidebar and main area show an hc outage until Retry reads the projects again", async () => {
  let down = true;
  let publish: (data: Sidebar) => void = () => {};
  const reason = "fake hc: the core is not running";
  await renderApp(transcript, null, {
    sidebar: async () => {
      if (down) return { projects: [], selected: "", hcError: reason };
      publish(sidebar);
      return sidebar;
    },
    onSidebar(listener) {
      publish = listener;
      return () => { publish = () => {}; };
    },
  });
  const note = page.getByRole("alert", { name: "hc error" });
  const projects = page.getByRole("navigation", { name: "Projects" });
  await expect.poll(() => css("p", note)?.textContent).toBe("hc is not reachable.");
  await expect.poll(() => css("pre", note)?.textContent).toBe(reason);
  await expect.element(projects.getByText("hc is not reachable", { exact: true })).toBeVisible();
  await shoot("hc-down");

  down = false;
  await note.getByRole("button", { name: "Retry" }).click();
  await expect.element(projects.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await expect.element(note).not.toBeInTheDocument();
});
