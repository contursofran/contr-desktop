import { expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { count, css, helperPath, rect, shot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";
import type { ThemeChoice } from "../shared/api";

async function openSettings(chatScreenshot = false) {
  let theme: ThemeChoice = "system";
  await renderApp(transcript, null, {
    checkCore: async () => {},
    checkUpdate: async () => {},
    settings: async () => ({ theme, helper: helperPath }),
    setTheme: async (choice) => {
      theme = choice;
      if (choice !== "system") await commands.colorScheme(choice);
      return choice;
    },
  });
  const button = page.getByRole("button", { name: "Settings" });
  const project = page.getByRole("region", { name: "contr-desktop" });
  await expect.element(project).toBeVisible();
  if (chatScreenshot) await shot("settings-chat-system");
  await button.click();
  const view = page.getByRole("region", { name: "Settings" });
  const group = view.getByRole("radiogroup", { name: "Theme" });
  return { button, view, group, radio: (name: string) => group.getByRole("radio", { name }), project };
}

const canvas = () => getComputedStyle(document.body).backgroundColor;

test("Settings opens from the foot, sets the theme from the tokens and closes when an agent is picked", async () => {
  const { button, view, group, radio, project } = await openSettings(true);
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
  expect(group.getByRole("radio").elements().map((item) => item.textContent)).toEqual(["System", "Dark", "Light"]);
  await expect.element(radio("System")).toHaveAttribute("aria-checked", "true");

  const path = view.getByLabelText("Helper path");
  await expect.element(path).toHaveTextContent(helperPath);
  await document.fonts.ready;
  const box = rect(path);
  const text = path.element().firstElementChild!.getBoundingClientRect();
  expect(text.left).toBeLessThan(box.left);
  expect(Math.abs(text.right - box.right)).toBeLessThan(1);
  expect(box.width).toBeLessThanOrEqual(420);

  await radio("Dark").click();
  await expect.element(radio("Dark")).toHaveAttribute("aria-checked", "true");
  await expect.poll(canvas).toBe("rgb(20, 21, 24)");
  await shot("settings-dark");

  await radio("Light").click();
  await expect.poll(canvas).toBe("rgb(239, 240, 242)");
  await shot("settings-light");
  const agent = project.getByRole("button", { name: /Chat panel usability audit/ });
  await agent.click();
  await expect.element(view).not.toBeInTheDocument();
  await expect.element(page.getByText("Sign-in retry handoff")).toBeVisible();
  await shot("settings-chat-light");

  await button.click();
  await radio("Dark").click();
  await expect.poll(canvas).toBe("rgb(20, 21, 24)");
  await agent.click();
  await expect.element(view).not.toBeInTheDocument();
  await expect.element(page.getByText("Sign-in retry handoff")).toBeVisible();
  await shot("settings-chat-dark");
});

test("the theme control moves with the arrow keys, aligns its indicator and has one tab stop", async () => {
  const { view, group, radio } = await openSettings();
  await expect.element(radio("System")).toHaveAttribute("aria-checked", "true");
  (await radio("System").findElement()).focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(radio("Dark")).toHaveFocus();
  await expect.element(radio("Dark")).toHaveAttribute("aria-checked", "true");
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(radio("Light")).toHaveAttribute("aria-checked", "true");
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(radio("Dark")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => count("[tabindex='0']", group)).toBe(1);
  for (const [name, scheme] of [["Dark", "dark"], ["Light", "light"]] as const) {
    await radio(name).click();
    await expect.element(radio(name)).toHaveAttribute("data-checked", "");
    const x = Math.round(rect(radio(name)).x);
    await expect.poll(() => Math.round(css("[data-slot='segmented-control-indicator']", group).getBoundingClientRect().x)).toBe(x);
    (document.activeElement as HTMLElement | null)?.blur();
    await shot(`uisdk-theme-${scheme}`, view);
  }
});

test("reply and code tooltips show on hover and focus, and Escape dismisses the focused tooltip", async () => {
  await renderApp(transcript);
  const tip = page.getByRole("tooltip");
  await page.getByRole("button", { name: "Attach image" }).hover();
  await expect.element(tip).toHaveTextContent("Attach image");
  await shot("uisdk-tip-attach-dark");
  await commands.colorScheme("light");
  await shot("uisdk-tip-attach-light");
  await commands.resetPointer();
  await expect.element(tip).not.toBeInTheDocument();

  const ring = page.getByLabelText("Context 37%");
  (await page.getByRole("button", { name: "Model" }).findElement()).focus();
  await userEvent.keyboard("{Tab}");
  await expect.element(ring).toHaveFocus();
  await expect.poll(() => tip.elements().length).toBe(1);
  await expect.element(tip).toHaveTextContent("37% of the model's context window");
  await userEvent.keyboard("{Escape}");
  await expect.element(tip).not.toBeInTheDocument();
  await expect.element(ring).toHaveFocus();

  await page.getByRole("button", { name: "Copy code" }).first().hover();
  await expect.element(tip).toHaveTextContent("Copy code");
  await shot("uisdk-tip-copy-dark");
  await commands.colorScheme("light");
  await shot("uisdk-tip-copy-light");
});
