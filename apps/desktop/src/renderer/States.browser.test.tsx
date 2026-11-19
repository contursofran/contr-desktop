import { expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";
import { css, helperError, helperPath, rect, rows, selectable, shoot, transcript } from "../../test/281-shell";
import { sidebar } from "../../test/275-sidebar";
import { renderApp } from "../../test/renderApp";

test("the helper error aligns with the reply box, disables it and clears on Retry", async () => {
  let down = true;
  await renderApp(transcript, null, {
    ...selectable(sidebar).overrides,
    settings: async () => ({ theme: "system", helper: helperPath }),
    onFeed(listener) {
      listener(down ? helperError : { type: "splice", at: 0, rows: rows(transcript), agent: "claude" });
      return () => {};
    },
  });
  const nav = page.getByRole("navigation", { name: "Projects" });
  await expect.element(nav.getByText("Orchestrating · 3 workers")).toBeVisible();
  const alert = page.getByRole("alert", { name: "Helper error" });
  await expect.poll(() => css("p", alert)?.textContent).toBe("hc is not running.");
  expect(css("pre", alert).textContent).toBe("no-core: fake error no-core");
  await expect.element(alert.getByLabelText("Helper path")).toHaveTextContent(helperPath);

  const style = document.createElement("style");
  style.textContent = "::-webkit-scrollbar { width: 15px; }";
  document.head.append(style);
  onTestFinished(() => style.remove());
  const block = rect(alert);
  const reply = rect(page.getByRole("form", { name: "Reply" }));
  expect(Math.abs(block.x - reply.x)).toBeLessThan(1);
  expect(Math.abs(block.width - reply.width)).toBeLessThan(1);
  const textbox = page.getByRole("textbox", { name: /^Reply to/ });
  await expect.element(textbox).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "Attach image" })).toBeDisabled();
  const status = page.getByRole("main").getByText(/Orchestrating/);
  await expect.element(status).not.toBeInTheDocument();
  await shoot("helper-error");

  down = false;
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect.element(alert).not.toBeInTheDocument();
  await expect.element(textbox).toBeEnabled();
  await expect.element(page.getByRole("main").getByText("Orchestrating · 3 workers")).toBeVisible();
});

test("an empty sidebar and main area say how an agent shows", async () => {
  await renderApp(transcript, null, { sidebar: async () => ({ selected: "", projects: [] }) });
  const empty = page.getByRole("note", { name: "No agent" });
  await expect.element(empty).toHaveTextContent("No agents yetAn agent that runs in an hc terminal shows here.");
  await expect.element(page.getByRole("navigation", { name: "Projects" }).getByText("No agents", { exact: true })).toBeVisible();
  await shoot("no-agents");
});

test("with more tabs than fit, the scrollbar is below the tabs", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  await page.viewport(900, 600);
  expect(window.innerWidth).toBe(900);
  const nav = page.getByRole("navigation", { name: "Projects" });
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  for (const name of ["Install health check", "Release notes draft", /^Cards/, /^Flow/, /^Virtual/]) {
    await nav.getByRole("button", { name, exact: false }).first().click();
    await expect.element(tabs.getByRole("tab", { name, exact: false })).toHaveAttribute("aria-selected", "true");
  }
  const row = tabs.element() as HTMLElement;
  const box = row.getBoundingClientRect();
  const tab = row.querySelector('[role="tab"][aria-selected="true"]')!.parentElement!.getBoundingClientRect();
  const bar = row.closest(".h-10")!.getBoundingClientRect();
  expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
  // Playwright hides the native scrollbar in headless Chromium. Read its styled height
  // and check the clearance below the tab.
  const scrollbar = Number.parseFloat(getComputedStyle(row, "::-webkit-scrollbar").height);
  expect(scrollbar).toBeGreaterThan(0);
  expect(box.bottom - scrollbar - tab.bottom).toBeGreaterThanOrEqual(2);
  expect(tab.height).toBe(28);
  expect(bar.height).toBe(40);
  await shoot("tabs-scrollbar-narrow");
});
