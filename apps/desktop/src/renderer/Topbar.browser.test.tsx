import { expect, test } from "vitest";
import { cdp, commands, page, userEvent } from "vitest/browser";
import { sidebar } from "../../test/275-sidebar";
import { rows, selectable, shoot, shot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";

const names = ["Chat panel usability audit", "Install health check", "Release notes draft"];
const nav = page.getByRole("navigation", { name: "Projects" });
const tabs = page.getByRole("tablist", { name: "Tabs", exact: true });
const tab = (name: string | RegExp) => tabs.getByRole("tab", { name, exact: true });
const agent = (name: string | RegExp) => nav.getByRole("button", { name, exact: false });
const reply = (name: string) => page.getByRole("textbox", { name: `Reply to ${name}` });
const bar = () => page.elementLocator(tabs.element().parentElement!.parentElement!);
const plus = page.getByRole("button", { name: "New tab" });
const titles = () => tabs.getByRole("tab").elements().map((el) => el.textContent?.trim());
const item = (name: string) => tab(name).element().parentElement!;

async function open(name: string | RegExp) {
  await agent(name).click();
  await expect.element(tab(name)).toHaveAttribute("aria-selected", "true");
}

test("opened tabs use the topbar layout and show full titles on hover", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  await open(names[1]);
  await expect.element(plus).toBeEnabled();
  await open(names[2]);
  await tab(names[1]).click();
  await expect.element(tab(names[1])).toHaveAttribute("aria-selected", "true");
  expect(titles()).toEqual(names);
  await document.fonts.ready;

  for (const name of names) expect(item(name).getBoundingClientRect().width).toBeLessThanOrEqual(180);
  const title = (name: string) => item(name).querySelector<HTMLElement>("[data-title]")!;
  const fits = (name: string) => title(name).scrollWidth <= title(name).clientWidth;
  expect(fits(names[2])).toBe(true);
  expect(fits(names[0])).toBe(false);
  expect(title(names[0])).toHaveStyle({ textOverflow: "ellipsis" });
  await tab(names[0]).hover();
  await expect.element(page.getByRole("tooltip")).toHaveTextContent(names[0]);
  await tab(names[0]).unhover();

  expect(tabs.element().querySelectorAll("[data-tab-close]")).toHaveLength(0);
  await expect.element(page.getByRole("button", { name: `Close ${names[1]}` })).toBeVisible();
  const [first, second] = names.map((name) => item(name).getBoundingClientRect());
  expect(first.height).toBe(28);
  expect(first.x - tabs.element().parentElement!.parentElement!.getBoundingClientRect().x).toBe(10);
  expect(Math.round(second.x - first.right)).toBe(2);
  expect(item(names[1])).toHaveStyle({ borderTopLeftRadius: "8px", fontSize: "12.5px", fontWeight: "400" });
  expect(getComputedStyle(item(names[0])).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(getComputedStyle(item(names[1])).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  const { width, height } = plus.element().getBoundingClientRect();
  expect([width, height]).toEqual([26, 26]);
  await shoot("148-tabs-after", bar());
});

test("the scroll row is the named tab list and the new-tab button is outside it", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  await expect.element(tabs).toHaveAttribute("data-tab-row");
  await expect.element(tab(names[0])).toBeVisible();
  expect(titles()).toEqual([names[0]]);
  await expect.element(plus).toBeVisible();
  await expect.element(tabs.getByRole("button", { name: "New tab" })).not.toBeInTheDocument();
});

test("keyboard focus leaves room for the selected tab's ellipsis and uses the theme ring", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  const [first, name, last] = names;
  await open(name);
  await open(last);
  await open(name);
  await document.fonts.ready;
  const focused = tab(name).element() as HTMLButtonElement;
  const wrapper = item(name);
  const title = focused.querySelector<HTMLElement>("[data-title]")!;

  for (const [width, height] of [[640, 480], [1400, 900]] as const) {
    await page.viewport(width, height);
    (tab(first).element() as HTMLElement).focus();
    const titleWidth = title.getBoundingClientRect().width;
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(tab(name)).toHaveFocus();
    expect(focused.matches(":focus-visible")).toBe(true);
    expect(title.getBoundingClientRect().width).toBe(titleWidth);
    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    expect(title).toHaveStyle({ textOverflow: "ellipsis", overflow: "hidden" });
    expect(wrapper.getBoundingClientRect().width).toBeLessThanOrEqual(180);

    for (const [scheme, color] of [["dark", "rgba(255, 255, 255, 0.5)"], ["light", "rgba(0, 0, 0, 0.45)"]] as const) {
      await commands.colorScheme(scheme);
      const ring = getComputedStyle(wrapper);
      const ringInside = -Number.parseFloat(ring.outlineOffset);
      expect(wrapper.getBoundingClientRect().right - title.getBoundingClientRect().right).toBeGreaterThan(ringInside);
      expect(ring.outlineStyle).toBe("solid");
      expect(ring.outlineColor).toBe(color);
      expect(getComputedStyle(focused).outlineStyle).toBe("none");
      await shot(`313-tab-${width}-${scheme}`, bar());
    }
  }
});

test("arrows, Home and End move tab focus, and Enter and Space select the focused tab", async () => {
  const selection = selectable(sidebar);
  let deliverFirst: (() => void) | undefined;
  const feedRows = rows(transcript);
  await renderApp(transcript, null, {
    ...selection.overrides,
    onFeed(listener) {
      const first = () => {
        listener({ type: "splice", at: 0, rows: feedRows, agent: "claude" });
        listener({ type: "card", card: null });
      };
      if (selection.selected() === "t12") deliverFirst = first;
      else first();
      return () => { if (deliverFirst === first) deliverFirst = undefined; };
    },
  });
  await open(names[1]);
  await open(names[2]);
  const [first, second, last] = names.map(tab);
  const selected = tabs.getByRole("tab", { selected: true });
  await expect.element(selected).toHaveTextContent(names[2]);
  expect(tabs.element().querySelector('[role="tab"][tabindex="0"]')?.textContent?.trim()).toBe(names[2]);
  (last.element() as HTMLElement).focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(first).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(last).toHaveFocus();
  await userEvent.keyboard("{Home}");
  await expect.element(first).toHaveFocus();
  await userEvent.keyboard("{End}");
  await expect.element(last).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(second).toHaveFocus();
  await expect.element(selected).toHaveTextContent(names[2]);
  await userEvent.keyboard("{Enter}");
  const secondReply = reply(names[1]);
  await expect.element(secondReply).toBeVisible();

  // The first response leaves focus on the tab so the arrow keys still work.
  const loading = page.getByRole("status", { name: "Reading the chat" });
  await expect.element(loading).toBeVisible();
  await expect.element(second).toHaveFocus();
  await expect.poll(() => deliverFirst).toBeTypeOf("function");
  deliverFirst!();
  await expect.element(loading).not.toBeInTheDocument();
  await expect.element(second).toHaveFocus();
  await shoot("303-keyboard-tab-focus", bar());
  await expect.element(secondReply).toHaveValue("");
  await expect.element(selected).toHaveTextContent(names[1]);

  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(first).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect.element(reply(names[0])).toBeVisible();
  expect(titles()).toEqual(names);
});

test("Herdr shortcuts and wheel switch open tabs in order", async () => {
  await renderApp(transcript, null, { ...selectable(sidebar).overrides, platform: "darwin" });
  await open(names[1]);
  await open(names[2]);
  const selected = tabs.getByRole("tab", { selected: true });
  const key = async (chord: string, name: string) => {
    await userEvent.keyboard(chord);
    await expect.element(selected).toHaveTextContent(name);
  };
  await key("{Control>}{Tab}{/Control}", names[0]);
  await key("{Control>}{Shift>}{Tab}{/Shift}{/Control}", names[2]);
  await key("{Meta>}2{/Meta}", names[1]);
  const bracket = (key: string) => selected.element()
    .dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  bracket("}");
  await expect.element(selected).toHaveTextContent(names[2]);
  bracket("{");
  await expect.element(selected).toHaveTextContent(names[1]);

  const scroll = (deltaX: number, deltaY: number, deltaMode: number = WheelEvent.DOM_DELTA_LINE) =>
    tabs.element().dispatchEvent(new WheelEvent("wheel", { deltaX, deltaY, deltaMode, bubbles: true }));
  scroll(30, 0);
  await expect.element(selected).toHaveTextContent(names[1]);
  scroll(0, 1);
  await expect.element(selected).toHaveTextContent(names[2]);
  scroll(0, 5, WheelEvent.DOM_DELTA_PIXEL);
  await expect.element(selected).toHaveTextContent(names[2]);
  scroll(0, 20, WheelEvent.DOM_DELTA_PIXEL);
  await expect.element(selected).toHaveTextContent(names[0]);
  scroll(0, -1);
  await expect.element(selected).toHaveTextContent(names[2]);
});

test("a tab drag shows a thin drop line and cancels when released outside the strip", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  const [a, b] = names;
  await open(b);
  const from = tab(b).element().getBoundingClientRect();
  const to = tab(a).element().getBoundingClientRect();
  // CDP uses coordinates in the outer page. The test mounts the app in an iframe.
  const frame = window.frameElement?.getBoundingClientRect();
  const y = (frame?.top ?? 0) + from.top + from.height / 2;
  const start = (frame?.left ?? 0) + from.left + from.width / 2;
  const drop = (frame?.left ?? 0) + to.left + 10;
  const mouse = cdp();
  await mouse.send("Input.dispatchMouseEvent", { type: "mousePressed", x: start, y, button: "left", buttons: 1, clickCount: 1 });
  try {
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: start - 10, y, buttons: 1 });
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: drop, y, buttons: 1 });
    const lines = () => tabs.element().querySelectorAll("[data-grabbed]");
    await expect.poll(() => lines().length).toBe(1);
    expect(lines()[0].getBoundingClientRect().width).toBeLessThanOrEqual(3);
    await shoot("326-tab-drag", tabs);
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: drop, y: y + 40, buttons: 1 });
  } finally {
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: drop, y: y + 40, button: "left", clickCount: 1 });
  }
  await expect.poll(() => tabs.element().querySelector("[data-grabbed]")).toBeNull();
  expect(titles()).toEqual([a, b]);
  await expect.element(tab(b)).toHaveAttribute("aria-selected", "true");
});

test("Alt moves tabs and keeps focus on the moved tab, while a plain arrow only moves focus", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  const [a, b] = names;
  await open(b);
  await expect.element(reply(b)).toBeVisible();
  (tab(b).element() as HTMLElement).focus();
  await userEvent.keyboard("{Alt>}{Home}{/Alt}");
  expect(titles()).toEqual([b, a]);
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
  expect(titles()).toEqual([a, b]);
  await expect.element(tab(b)).toHaveFocus();
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
  expect(titles()).toEqual([b, a]);
  await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
  expect(titles()).toEqual([a, b]);
  await userEvent.keyboard("{Alt>}{Home}{/Alt}");
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(tab(a)).toHaveFocus();
  expect(titles()).toEqual([b, a]);
  await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
  expect(titles()).toEqual([a, b]);
  await expect.element(tab(a)).toHaveFocus();
  await userEvent.keyboard("{Alt>}{End}{/Alt}");
  expect(titles()).toEqual([b, a]);
});

test("in a narrow window the shown tab scrolls into view above a thin scrollbar", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  await page.viewport(900, 600);
  expect(window.innerWidth).toBe(900);
  const row = (await tabs.findElement()) as HTMLElement;
  const inView = () => {
    const shown = row.querySelector('[role="tab"][aria-selected="true"]')?.parentElement;
    if (!shown) return false;
    const bounds = shown.getBoundingClientRect();
    const viewport = row.getBoundingClientRect();
    return bounds.left >= viewport.left - 0.5 && bounds.right <= viewport.right + 0.5;
  };

  for (const name of [names[1], names[2], /^Cards/, /^Flow/, /^Virtual/]) {
    await open(name);
    await expect.poll(inView).toBe(true);
  }
  expect(titles()).toHaveLength(6);
  expect(row.scrollWidth > row.clientWidth && row.scrollLeft > 0).toBe(true);
  // Headless Chromium hides native scrollbars. Check the styled height and room below the tabs.
  const scrollbar = Number.parseFloat(getComputedStyle(row, "::-webkit-scrollbar").height);
  expect(scrollbar).toBe(3);
  expect(row.getBoundingClientRect().bottom - scrollbar - item("Virtual list").getBoundingClientRect().bottom).toBeGreaterThanOrEqual(2);
  await shoot("282-tabs-narrow", bar());

  await open(names[0]);
  await expect.poll(inView).toBe(true);
  await expect.poll(() => row.scrollLeft).toBe(0);
  const last = tabs.getByRole("tab").last();
  await last.click();
  await expect.element(last).toHaveAttribute("aria-selected", "true");
  await expect.poll(inView).toBe(true);
  await page.viewport(700, 600);
  expect(window.innerWidth).toBe(700);
  await expect.poll(inView).toBe(true);
  await page.getByRole("button", { name: "Close Virtual list" }).click();
  await expect.poll(() => titles().length).toBe(5);
  await expect.poll(inView).toBe(true);
});

for (const view of ["Inbox", "Settings"] as const) {
  test(`with ${view} shown, the agent row and tab lose selection until chat returns`, async () => {
    await renderApp(transcript, null, {
      ...selectable(sidebar).overrides,
      checkUpdate: async () => {},
      checkCore: async () => {},
    });
    const original = agent(names[0]);
    await expect.element(original).toHaveAttribute("aria-current", "true");
    await expect.element(tab(names[0])).toHaveAttribute("aria-selected", "true");
    const inbox = nav.getByRole("button", { name: /^Inbox/ });
    const settings = page.getByRole("button", { name: "Settings", exact: true });
    await (view === "Inbox" ? inbox : settings).click();
    await expect.element(page.getByRole("region", { name: view })).toBeVisible();
    expect(Array.from(nav.element().querySelectorAll("[aria-current]"), (el) => el.textContent))
      .toEqual(view === "Inbox" ? [expect.stringMatching(/^Inbox/)] : []);
    await expect.element(tabs.getByRole("tab", { selected: true })).not.toBeInTheDocument();
    await shoot(`282-selected-${view.toLowerCase()}`);
    await tab(names[0]).click();
    await expect.element(reply(names[0])).toBeVisible();
    await expect.element(original).toHaveAttribute("aria-current", "true");
    await expect.element(tab(names[0])).toHaveAttribute("aria-selected", "true");
  });
}
