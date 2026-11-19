import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { sidebar } from "../../test/275-sidebar";
import { renderApp } from "../../test/renderApp";

async function shoot(name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await page.screenshot({ path: `../../../../tmp/shots/browser/${name}-${scheme}.png` });
  }
}

test("the machine switch opens with keys and the mouse, keeps This computer, and gives focus back", async () => {
  await renderApp(transcript, null, {
    sidebar: async () => sidebar,
    machines: async () => [
      { name: "aerum-pc", state: "connected" },
      { name: "vps", state: "unreachable" },
    ],
  });
  const trigger = page.getByRole("button", { name: "Machine, This computer" });
  const menu = page.getByRole("menu", { name: "Machine, This computer" });
  const local = menu.getByRole("menuitemradio", { name: "This computer" });
  await expect.element(trigger).toHaveTextContent("This computer");

  (await trigger.findElement()).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(menu).toBeVisible();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => menu.getByRole("menuitemradio").elements().map((item) => item.textContent))
    .toEqual(["This computer", "aerum-pc", "vpsunreachable"]);
  await expect.element(local).toHaveAttribute("aria-checked", "true");
  await expect.element(menu.getByRole("menuitem", { name: "Add machine…" })).toBeVisible();
  await shoot("sidebar-machines");
  await userEvent.keyboard("{Enter}");
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(trigger).toHaveTextContent("This computer");
  await expect.element(trigger).toHaveFocus();

  await userEvent.keyboard("{Enter}");
  await expect.element(menu).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(trigger).toHaveFocus();

  await trigger.click();
  await expect.element(menu).toBeVisible();
  await local.click();
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(trigger).toHaveTextContent("This computer");

  await trigger.click();
  await expect.element(menu).toBeVisible();
  await page.getByRole("textbox", { name: /Reply to/ }).click();
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(trigger).toHaveTextContent("This computer");
});

test("the sidebar and top bar tooltips show on hover and focus, and Escape or leaving hides them", async () => {
  await renderApp(transcript, null, { sidebar: async () => sidebar });
  const tip = page.getByRole("tooltip");
  const nav = page.getByRole("navigation", { name: "Projects" });

  await nav.getByRole("button", { name: /Flow and sequence diagrams/ }).hover();
  await expect.element(tip).toHaveTextContent("b-30 · #30 · Flow and sequence diagrams");
  await shoot("sidebar-row-tooltip");
  await userEvent.keyboard("{Escape}");
  await expect.element(tip).not.toBeInTheDocument();

  await nav.getByRole("button", { name: /Chat panel usability audit/ }).hover();
  await expect.element(tip).toHaveTextContent("Chat panel usability audit");
  await page.getByRole("textbox", { name: /Reply to/ }).hover();
  await expect.element(tip).not.toBeInTheDocument();

  const tabs = page.getByRole("tablist", { name: "Tabs" });
  await tabs.getByRole("tab", { name: "Chat panel usability audit" }).hover();
  await expect.element(tip).toHaveTextContent("Chat panel usability audit");
  await page.getByRole("button", { name: "New tab" }).hover();
  await expect.element(tip).toHaveTextContent("New tab");
  await shoot("topbar-tooltip");

  const search = page.getByRole("button", { name: "Search" });
  (await search.findElement()).focus();
  await expect.element(tip).toHaveTextContent("Search (not yet)");
  await userEvent.keyboard("{Tab}");
  await expect.element(tip).toHaveTextContent("Hide sidebar");
  await userEvent.keyboard("{Escape}");
  await expect.element(tip).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Hide sidebar" })).toHaveFocus();

  await page.getByRole("button", { name: "Add machine" }).hover();
  await expect.element(tip).toHaveTextContent("Add machine (not yet)");
  await shoot("sidebar-foot-tooltip");
});
