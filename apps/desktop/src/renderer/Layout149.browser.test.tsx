import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { sidebar as fixtureSidebar } from "../../test/275-sidebar";
import { ownerFake, renderCards, shoot } from "../../test/280-browser";

const bounds = (element: Element) => element.getBoundingClientRect();
const edges = (element: Element) => {
  const { left, right } = bounds(element);
  return [left, right];
};
const textBounds = (element: Element) => {
  const text = document.createRange();
  text.selectNodeContents(element);
  return text.getBoundingClientRect();
};
const textRight = (element: Element) => textBounds(element).right;

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
  await renderCards(null, { ...ownerFake().api, sidebar: async () => sidebar });
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

  const idLeft = bounds(inbox.getByText("D8", { exact: true }).element()).left;
  for (const id of ["D9", "T3", "T4"]) {
    expect(bounds(inbox.getByText(id, { exact: true }).element()).left).toBeCloseTo(idLeft, 1);
  }
  // screens.html gives the open card a 1 px border, -8 px body margin and 12 px text padding.
  for (const text of ["D7", "Which items show first in the inbox?"]) {
    const left = textBounds(card.getByText(text, { exact: true }).element()).left;
    expect(left - idLeft).toBeCloseTo(5, 1);
  }
  const end = textRight(blocked.getByText("Open chat", { exact: true }).element());
  for (const label of ["2 answers", "1 answer"]) {
    expect(textRight(inbox.getByText(label, { exact: true }).element())).toBeCloseTo(end, 1);
  }
  const done = inbox.getByRole("button", { name: "Done", exact: true }).elements();
  expect(done).toHaveLength(2);
  for (const button of done) expect(textRight(button)).toBeCloseTo(end, 1);

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
  const right = textRight(settings.getByLabelText("Current version").element());
  for (const label of ["Newest version", "Core version", "Newest core version"]) {
    expect(textRight(settings.getByLabelText(label).element())).toBeCloseTo(right, 1);
  }
  const copy = settings.getByRole("button", { name: "Copy path" }).element();
  const icon = bounds(copy.querySelector("svg")!);
  expect(bounds(copy).width).toBe(22);
  expect(icon.right).toBeCloseTo(right, 1);
  expect(textRight(settings.getByLabelText("Helper path").element())).toBeLessThan(icon.left);
  await shoot("149-settings");
});
