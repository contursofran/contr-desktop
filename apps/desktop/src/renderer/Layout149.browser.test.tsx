import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { sidebar as fixtureSidebar } from "../../test/275-sidebar";
import { ownerFake, renderCards, shoot } from "../../test/280-browser";

const bounds = (element: Element) => element.getBoundingClientRect();
const edges = (element: Element) => {
  const { left, right } = bounds(element);
  return [left, right];
};

test("usage meter tracks align when one value is stale", async () => {
  await renderCards(null, {
    usage: async () => [
      { plan: "Claude", value: "—", percent: null, readAt: null },
      { plan: "Codex", value: "33% wk · 4d", percent: 33, readAt: null },
    ],
  });
  const claude = page.getByRole("meter", { name: "Claude usage" });
  const codex = page.getByRole("meter", { name: "Codex usage" });
  await expect.element(claude).toHaveAttribute("aria-valuetext", "No current data");
  await expect.element(codex).toHaveAttribute("aria-valuenow", "33");
  await document.fonts.ready;

  expect(bounds(claude.element()).width).toBeGreaterThan(0);
  expect(edges(claude.element())).toEqual(edges(codex.element()));
  await shoot("149-usage");
});

test("the Inbox header, open card and blocked row share the centered reading width", async () => {
  const sidebar = structuredClone(fixtureSidebar);
  sidebar.projects[0].agents[1].state = "blocked";
  await renderCards(null, { ...ownerFake(["D7"]).api, sidebar: async () => sidebar });
  await page.viewport(1920, 900);
  await page.getByRole("button", { name: /^Inbox/ }).click();

  const inbox = page.getByRole("region", { name: "Inbox" });
  const card = inbox.getByRole("region", { name: "Owner question" });
  await expect.element(card.getByText(/Chat panel usability audit/)).toBeVisible();
  const blocked = inbox.getByRole("button", { name: /Release notes draft.*Waits on a prompt/ });
  await expect.element(blocked).toBeVisible();
  const header = inbox.getByRole("heading", { name: "Inbox" }).element().parentElement!;
  const row = blocked.element().parentElement!;
  const pane = bounds(inbox.element());

  expect(bounds(card.element()).width).toBe(760);
  expect(edges(header)).toEqual(edges(card.element()));
  expect(edges(row)).toEqual(edges(card.element()));
  expect(bounds(card.element()).left - pane.left).toBeCloseTo(pane.right - bounds(card.element()).right, 0);

  // A change to the reading width must apply to the whole Inbox.
  const style = (inbox.element() as HTMLElement).style;
  style.setProperty("--container-read", "720px");
  expect([header, card.element(), row].map((element) => bounds(element).width)).toEqual([720, 720, 720]);
  style.removeProperty("--container-read");
  await shoot("149-inbox");
});

test("Settings groups stay in a centered 640 px column at a wide viewport", async () => {
  await renderCards(null, { checkCore: async () => {}, checkUpdate: async () => {} });
  await page.viewport(1920, 900);
  await page.getByRole("button", { name: "Settings" }).click();

  const settings = page.getByRole("region", { name: "Settings" });
  await expect.element(settings.getByLabelText("Helper path")).toHaveTextContent("/work/bin/herdr-contr-feed");
  const pane = bounds(settings.element());
  const column = bounds(settings.getByRole("heading", { name: "Settings" }).element());
  expect(column.width).toBe(640);
  expect(column.left - pane.left).toBeCloseTo(pane.right - column.right, 0);
  for (const name of ["Appearance", "Updates", "Core", "Helper"]) {
    const group = settings.getByRole("heading", { name, exact: true }).element().parentElement!;
    expect(edges(group)).toEqual([column.left, column.right]);
  }
  await shoot("149-settings");
});
