import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import { color, css, rect, shoot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";

test("the sidebar head has the machine switch, the foot the plan usage and Settings", async () => {
  await renderApp(transcript, null, {
    usage: async () => [
      { plan: "Claude", percent: 64, value: "64% wk · 4d", readAt: null },
      { plan: "Codex", percent: 21, value: "21% 5h · 3h", readAt: null },
    ],
  });
  await page.getByRole("button", { name: "Machine, This computer" }).findElement();
  const head = page.elementLocator(css("aside > header"));
  await expect.poll(() => head.query()?.textContent).toMatch(/contr/);
  const machine = head.getByRole("button", { name: "Machine, This computer" });
  await expect.element(machine).toHaveTextContent("This computer");
  const label = head.getByTestId("machine-label");
  const search = head.getByRole("button", { name: "Search" });
  await expect.element(head).toHaveStyle({ height: "40px" });
  const labelBox = rect(label);
  const searchBox = rect(search);
  expect(Math.abs(labelBox.y + labelBox.height / 2 - searchBox.y - searchBox.height / 2)).toBeLessThan(1);
  await expect.element(label).toHaveStyle({ textOverflow: "ellipsis", fontSize: "12px" });
  expect(getComputedStyle(label.element(), "::after").content).toBe('" ▾"');
  await expect.element(head.getByRole("button", { name: "Machine, This computer" })).toBeVisible();
  await machine.hover();
  await expect.element(page.getByRole("tooltip")).toHaveTextContent("This computer");
  await commands.resetPointer();
  await expect.element(search).toHaveAttribute("aria-disabled", "true");
  await expect.element(head.getByRole("button", { name: "Hide sidebar" })).toBeVisible();

  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect.poll(() => usage.getByRole("listitem").elements().map((item) => item.textContent))
    .toEqual(["Claude64% wk · 4d", "Codex21% 5h · 3h"]);
  await expect.element(usage.getByRole("meter", { name: "Claude usage" })).toHaveAttribute("aria-valuenow", "64");
  const foot = page.elementLocator(css("aside > footer"));
  await expect.element(foot.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect.element(foot.getByRole("button", { name: "Add machine" })).toHaveAttribute("aria-disabled", "true");
  await expect.element(page.getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await shoot("sidebar-head-foot");
});

test.each([["darwin", 76], ["linux", 10]] as const)("the sidebar toggle keeps its geometry on %s", async (platform, left) => {
  await renderApp(transcript, null, { platform });
  await page.viewport(900, 600);
  expect(window.innerWidth).toBe(900);
  const hide = page.getByRole("button", { name: "Hide sidebar" });
  const show = page.getByRole("button", { name: "Show sidebar" });
  await expect.element(show).not.toBeInTheDocument();
  await hide.click();
  await expect.poll(() => document.querySelector("aside")).toBeNull();
  await expect.element(show).toBeVisible();
  expect(show.element().parentElement!.getBoundingClientRect().x).toBe(0);
  const box = rect(show);
  expect(box.x).toBe(left);
  expect([box.width, box.height]).toEqual([26, 26]);
  expect(getComputedStyle(show.element()).getPropertyValue("-webkit-app-region")).toBe("no-drag");
  await expect.element(page.getByRole("textbox", { name: "Reply to Chat panel usability audit" })).toBeVisible();
  if (platform === "darwin") await shoot("sidebar-hidden");
  await show.click();
  await expect.element(hide).toBeVisible();
  await expect.element(show).not.toBeInTheDocument();
});

test("Add machine… in the machine menu is inert and says so", async () => {
  await renderApp(transcript);
  await page.getByRole("button", { name: "Machine, This computer" }).click();
  const add = page.getByRole("menu", { name: "Machine, This computer" }).getByRole("menuitem", { name: "Add machine…" });
  await expect.element(add).toHaveAttribute("aria-disabled", "true");
  expect(getComputedStyle(add.element()).color).toBe(color("--color-faint"));
  await add.hover();
  await expect.element(page.getByRole("tooltip")).toHaveTextContent("Add machine (not yet)");
  await add.click({ force: true });
  await expect.element(add).toBeVisible();
  await shoot("machine-add-inert");
});
