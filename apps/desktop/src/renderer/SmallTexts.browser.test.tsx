import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { css, helperError, helperPath, rect, replyInfo, shoot, transcript } from "../../test/281-shell";
import { renderApp } from "../../test/renderApp";

afterEach(() => vi.restoreAllMocks());

test("at 600 px the model button stays on one line and the shown tab fits the row; model, context and menu say plain words", async () => {
  await renderApp(transcript, null, { replyInfo: async () => replyInfo() });
  await page.viewport(600, 450);
  const tip = page.getByRole("tooltip");
  const model = page.getByRole("button", { name: "Model" });
  await expect.poll(() => model.query()?.textContent).toMatch(/Opus 5\.5/);
  const height = (text: string) => rect(model.getByText(text, { exact: true })).height;
  await document.fonts.ready;
  await expect.poll(() => height("Opus 5.5") - height("medium")).toBe(0);

  const tab = page.getByRole("tab", { name: "Chat panel usability audit" });
  await expect.element(tab).toHaveAttribute("aria-selected", "true");
  await expect.element(tab).toHaveTextContent("Chat panel usability audit");
  await expect.poll(() => {
    const r = css("[data-tab-row]").getBoundingClientRect();
    const t = tab.element().parentElement!.getBoundingClientRect();
    return t.x >= r.x - 0.5 && t.right <= r.right + 0.5;
  }).toBe(true);
  await shoot("small-texts-600");

  await model.hover();
  await expect.element(tip).toHaveTextContent("Opus 5.5 · medium effort · Claude Code");
  await shoot("small-texts-model-tip");
  await page.getByLabelText("Context 37%").hover();
  await expect.element(tip).toHaveTextContent("37% of the model's context window");
  await shoot("small-texts-context-tip");

  await model.click();
  const menu = page.getByRole("menu");
  const labels = (name: string) => menu.getByRole("group", { name }).getByRole("menuitemradio").elements().map((item) => item.textContent);
  await expect.poll(() => labels("Model")).toEqual(["Opus 5.5", "Sonnet 5"]);
  await expect.poll(() => labels("Effort")).toEqual(["low", "medium", "high"]);
  await shoot("small-texts-model-menu");
});

test("other machines are inert, and a project row has its name as tooltip", async () => {
  await renderApp(transcript, null, {
    machines: async () => [
      { name: "aerum-pc", state: "connected" },
      { name: "vps", state: "unreachable" },
      { name: "tmp-1", state: "connected" },
    ],
  });
  const tip = page.getByRole("tooltip");
  const project = page.getByRole("region", { name: "contr-desktop" });
  await expect.element(project).toBeVisible();
  const name = page.elementLocator(css("[data-name]", project));
  await expect.element(name).toHaveTextContent("contr-desktop");
  await name.hover();
  await expect.element(tip).toHaveTextContent("contr-desktop");
  await shoot("small-texts-project-tip");

  const trigger = page.getByRole("button", { name: "Machine, This computer" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Machine, This computer" });
  await expect.element(menu.getByRole("menuitemradio", { name: "This computer" })).toHaveAttribute("aria-checked", "true");
  const aerum = menu.getByRole("menuitemradio", { name: "aerum-pc", exact: false });
  await expect.element(aerum).toHaveAttribute("aria-disabled", "true");
  await expect.element(menu.getByRole("menuitemradio", { name: /vps/ })).toHaveAttribute("aria-disabled", "true");
  await aerum.hover();
  await expect.element(tip).toHaveTextContent("aerum-pc (not yet)");
  await shoot("small-texts-machines");
  await aerum.click({ force: true });
  await userEvent.keyboard("{Escape}");
  await expect.element(menu).not.toBeInTheDocument();
  await expect.element(trigger).toHaveTextContent("This computer");
});

test("a terminal with no known title gets the placeholder Reply, with no name", async () => {
  await renderApp(transcript, null, {
    sidebar: async () => ({ selected: "t1", projects: [] }),
    tabTitle: async () => ({ title: "Terminal" }),
  });
  const box = page.getByRole("form", { name: "Reply" }).getByRole("textbox");
  const tab = page.getByRole("tab", { name: "Terminal" });
  await expect.element(tab).toHaveAttribute("aria-selected", "true");
  await expect.element(tab).toHaveTextContent("Terminal");
  await expect.element(box).toHaveAttribute("placeholder", "Reply");
  await expect.element(box).toHaveAccessibleName("Reply");
  await shoot("small-texts-reply");
});

test("the helper path in Settings and in the helper error has a tooltip with the whole path and Copy", async () => {
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  await renderApp(transcript, null, {
    checkCore: async () => {},
    checkUpdate: async () => {},
    settings: async () => ({ theme: "system", helper: helperPath }),
    onFeed(listener) {
      listener(helperError);
      return () => {};
    },
  });
  const tip = page.getByRole("tooltip");
  const alert = page.getByRole("alert", { name: "Helper error" });
  await alert.getByLabelText("Helper path").hover();
  await expect.element(tip).toHaveTextContent(helperPath);
  await shoot("small-texts-helper-error");
  await alert.getByRole("button", { name: "Copy path" }).click();
  await expect.element(alert.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(copy).toHaveBeenCalledWith(helperPath);

  await page.viewport(900, 600);
  await page.getByRole("button", { name: "Settings" }).click();
  const view = page.getByRole("region", { name: "Settings" });
  await view.getByLabelText("Helper path").hover();
  await expect.element(tip).toHaveTextContent(helperPath);
  await expect.element(view.getByRole("button", { name: "Copy path" })).toBeVisible();
  await shoot("small-texts-settings-path");
});
