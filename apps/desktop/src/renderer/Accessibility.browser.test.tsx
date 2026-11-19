import { expect, test } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import { sidebar } from "../../test/275-sidebar";
import { ownerFake, questionCard, renderCards } from "../../test/280-browser";
import { replyInfo, selectable, shot, shoot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";

async function checkFocusRing(control: Locator) {
  const element = await control.findElement();
  const before = getComputedStyle(element).boxShadow;
  (element as HTMLElement).focus();
  await expect.element(control).toHaveFocus();
  expect(element.matches(":focus-visible")).toBe(true);
  expect(getComputedStyle(element).boxShadow).not.toBe(before);
}

test("the reply, both own answers and context have a visible keyboard focus ring", async () => {
  await renderCards(questionCard, { ...ownerFake().api, replyInfo: async () => replyInfo() });
  await userEvent.keyboard("{Tab}");
  const reply = page.getByRole("form", { name: "Reply" });
  const context = reply.getByRole("img", { name: "Context 37%" });
  await checkFocusRing(reply.getByRole("textbox", { name: /^Reply to / }));
  await shoot("148-reply-focus");
  await checkFocusRing(context);
  for (const name of ["Question", "Owner question"]) {
    await checkFocusRing(page.getByRole("region", { name }).getByRole("textbox", { name: "Own answer" }));
  }
  await expect.element(reply.getByRole("img", { name: "Branch: main" })).toBeVisible();
});

test("task checkboxes have names and a running tool has no live region", async () => {
  await renderApp([
    JSON.stringify({ id: "tasks", k: "assistant", ts: 0, text: "- [x] **Build** app\n  - [ ] Verify it\n- [ ] Ship app" }),
    JSON.stringify({ id: "tool", k: "perm", ts: 1, text: "Bash", perm: { title: "Bash", command: "pnpm test", tool: "Bash", toolUseId: "tool_1", state: "pending" } }),
  ].join("\n"));
  const chat = page.getByRole("list", { name: "Chat" });
  const built = chat.getByRole("checkbox", { name: "Build app", exact: true });
  await expect.element(built).toBeChecked();
  await expect.element(built).toBeDisabled();
  for (const name of ["Verify it", "Ship app"]) {
    const task = chat.getByRole("checkbox", { name, exact: true });
    await expect.element(task).not.toBeChecked();
    await expect.element(task).toBeDisabled();
  }
  await expect.element(chat.getByRole("img", { name: "running", exact: true })).toBeVisible();
  await expect.element(chat.getByRole("status", { name: "running", exact: true })).not.toBeInTheDocument();
});

test("inert controls stay out of the tab order and tabs name their panels", async () => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  for (const name of ["Search", "Add machine"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute("tabindex", "-1");
  }
  await expect.element(page.getByRole("button", { name: "Collapse contr-desktop" })).toBeVisible();
  const title = "Chat panel usability audit";
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  const tab = tabs.getByRole("tab", { name: title });
  const panel = page.getByRole("tabpanel", { name: title });
  await expect.element(panel.getByRole("textbox", { name: `Reply to ${title}` })).toBeVisible();
  await expect.element(tab).toHaveAttribute("aria-controls", panel.element().id);
  await expect.element(panel).toHaveAttribute("aria-labelledby", tab.element().id);
  await expect.element(tab).toHaveAttribute("aria-description", "Working");

  const close = page.getByRole("button", { name: `Close ${title}` });
  await expect.element(tabs.getByRole("button")).not.toBeInTheDocument();
  await expect.element(tabs.getByRole("img")).not.toBeInTheDocument();
  const slot = tabs.element().querySelector("[data-tab-close-anchor]");
  expect(close.element().getBoundingClientRect().toJSON()).toEqual(slot?.getBoundingClientRect().toJSON());
  (tab.element() as HTMLElement).focus();
  await userEvent.keyboard("{Tab}");
  await expect.element(close).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(page.getByRole("button", { name: "New tab" })).toHaveFocus();
});

function luminance(rgb: Uint8ClampedArray) {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

function contrast(colors: string[], foreground: string, opacity = 1) {
  const context = document.createElement("canvas").getContext("2d")!;
  for (const color of colors) {
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
  }
  const background = luminance(context.getImageData(0, 0, 1, 1).data);
  context.globalAlpha = opacity;
  context.fillStyle = foreground;
  context.fillRect(0, 0, 1, 1);
  const ink = luminance(context.getImageData(0, 0, 1, 1).data);
  return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05);
}

test.each(["dark", "light"] as const)("worker icon and tab scrollbar reach 3:1 in %s", async (scheme) => {
  await renderApp(transcript, null, selectable(sidebar).overrides);
  const worker = page.getByRole("button", { name: /^Cards for prompts and questions/ });
  const tabs = page.getByRole("tablist", { name: "Tabs" });
  for (const locator of [worker, page.getByRole("button", { name: /^Install health check/ })]) {
    await locator.click();
  }
  await page.viewport(550, 600);
  await commands.resetPointer();
  await commands.colorScheme(scheme);
  await expect.poll(() => matchMedia(`(prefers-color-scheme: ${scheme})`).matches).toBe(true);

  const row = worker.element();
  const path = row.querySelector('[data-icon="claude-code"] path')!;
  const picture = path.closest("[data-icon]")!.parentElement!;
  const side = getComputedStyle(row.closest("aside")!).backgroundColor;
  const iconRatio = contrast([side, getComputedStyle(row).backgroundColor], getComputedStyle(path).fill,
    Number(getComputedStyle(picture).opacity));
  expect.soft(iconRatio, "worker icon contrast").toBeGreaterThanOrEqual(3);

  const strip = tabs.element();
  expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
  const bar = strip.closest('[data-slot="tabs"]')!;
  const track = getComputedStyle(strip, "::-webkit-scrollbar-track").backgroundColor;
  const thumb = getComputedStyle(strip, "::-webkit-scrollbar-thumb").backgroundColor;
  expect(contrast([getComputedStyle(bar).backgroundColor, track], thumb), "tab scrollbar contrast").toBeGreaterThanOrEqual(3);
  await shot(`148-icon-contrast-${scheme}`);
});
