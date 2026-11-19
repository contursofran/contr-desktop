import { expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { shoot } from "../../test/274-chat";
import { agentRow, containsText, mountReply, replyBox, replyForm, replyState, sendError, statusLine } from "../../test/279-reply";
import type { ContrApi, ReplyInfo } from "../shared/api";

const model = () => page.getByRole("button", { name: "Model" });
const menu = () => page.getByRole("menu", { name: "Model" });
const choices = () => menu().getByRole("menuitemradio");
const option = (name: string) => menu().getByRole("menuitemradio", { name, exact: true });
const labels = () => choices().elements().map((el) => el.textContent?.trim());
const modelsAndEfforts = ["Opus 5.5", "Sonnet 5", "low", "medium", "high"];
const audit = () => agentRow(/Chat panel usability audit/);
const notes = () => agentRow(/Release notes draft/);
const clickSend = () => page.getByRole("button", { name: "Send" }).click();

test("the reply shows measured speed and lets the owner set the current model's speed tier", async () => {
  const setTier = vi.fn<ContrApi["setTier"]>(async () => ({ ok: true }));
  const { sent } = await mountReply({
    info: { tier: "fast", tiers: ["ultrafast", "fast"], speed: "58 tok/s" },
    overrides: { setTier },
  });
  await expect.element(model()).toHaveTextContent("Opus 5.5mediumfast");
  await expect.element(replyForm().getByText("58 tok/s", { exact: true })).toBeVisible();
  await model().click();
  await expect.element(menu().getByText("Speed", { exact: true })).toBeVisible();
  expect(labels()).toEqual([...modelsAndEfforts, "Standard", "Fast", "Ultrafast"]);
  await expect.element(option("Fast")).toHaveAttribute("aria-checked", "true");
  await shoot("reply-speed");
  await option("Ultrafast").click();
  await expect.element(model()).toHaveTextContent("Opus 5.5mediumultrafast");
  await expect.poll(() => setTier.mock.calls).toEqual([["t7", "ultrafast"]]);
  expect(sent()).toEqual([]);

  // The Electron case checks the helper's acknowledgement. Here the optimistic radio choice stays checked.
  await model().click();
  await expect.element(option("Ultrafast")).toHaveAttribute("aria-checked", "true");
  await option("Standard").click();
  await expect.element(model()).toHaveTextContent("Opus 5.5medium");
  await expect.poll(() => setTier.mock.calls).toEqual([["t7", "ultrafast"], ["t7", "standard"]]);

  await model().click();
  await option("Sonnet 5").click();
  await model().click();
  await expect.element(menu().getByText("Speed", { exact: true })).not.toBeInTheDocument();
});

test("a failed tier switch hides the Speed group and keeps the helper's tier", async () => {
  let tiers: ReplyInfo["tiers"] = ["fast", "ultrafast"];
  await mountReply({
    overrides: {
      replyInfo: async () => ({ ...replyState, tier: "fast", tiers }),
      setTier: async () => {
        // Main removes unsupported choices from subsequent replyInfo reads.
        tiers = [];
        return { ok: false, message: "This agent cannot switch speed tiers." };
      },
    },
  });
  await expect.element(model()).toHaveTextContent("Opus 5.5mediumfast");
  await model().click();
  await option("Ultrafast").click();
  await containsText(page.getByRole("alert")).toContain("This agent cannot switch speed tiers.");
  await expect.element(model()).toHaveTextContent("Opus 5.5mediumfast");
  await model().click();
  await expect.element(option("Ultrafast"), { timeout: 4500 }).not.toBeInTheDocument();
}, 10_000);

test("the reply box shows the model, effort, context and branch, and the menu sends /model and /effort", async () => {
  const { sent } = await mountReply({ overrides: { branch: async () => "agent/11-reply-menu" } });
  await expect.element(model()).toHaveTextContent("Opus 5.5medium");
  await expect.element(page.getByLabelText("Context 37%")).toHaveTextContent("37%");
  await expect.element(page.getByText(/tok\/s/)).not.toBeInTheDocument();
  await expect.element(page.getByLabelText("Branch")).toHaveTextContent("agent/11-reply-menu");
  await replyForm().screenshot({ path: "../../../../tmp/shots/browser/reply-foot-dark.png" });

  await model().click();
  await expect.element(menu()).toBeVisible();
  expect(labels()).toEqual(modelsAndEfforts);
  expect(menu().getByRole("menuitemradio", { checked: true }).elements().map((el) => el.textContent)).toEqual(["Opus 5.5", "medium"]);
  await shoot("reply-menu");

  await option("Sonnet 5").click();
  await expect.element(model()).toHaveTextContent("Sonnet 5medium");
  await expect.poll(sent).toEqual(["/model claude-sonnet-5"]);
  await model().click();
  await option("high").click();
  await expect.element(model()).toHaveTextContent("Sonnet 5high");
  await expect.poll(sent).toEqual(["/model claude-sonnet-5", "/effort high"]);
});

test("the menu opens before the first reply, when the helper knows no model (herdr-contr #209)", async () => {
  const { sent } = await mountReply({ info: { model: null, effort: null } });
  await expect.element(model()).toHaveAttribute("aria-haspopup", "menu");
  await expect.element(model()).toHaveTextContent("Model");
  await model().click();
  await option("Opus 5.5").click();
  await expect.poll(sent).toEqual(["/model claude-opus-5-5"]);
});

test("the menu moves with the keys, picks with Enter, and closes on Escape and outside clicks with focus back on the button", async () => {
  const { sent } = await mountReply();
  await expect.element(model()).toHaveTextContent("Opus 5.5medium");

  await model().click();
  await expect.element(menu()).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(menu()).not.toBeInTheDocument();
  await expect.element(model()).toHaveFocus();

  await model().click();
  await expect.element(menu()).toBeVisible();
  await page.getByRole("complementary").click({ position: { x: 5, y: 300 } });
  await expect.element(menu()).not.toBeInTheDocument();

  (await model().findElement() as HTMLElement).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(menu()).toBeVisible();
  await userEvent.keyboard("{ArrowDown}");
  await expect.poll(() => menu().query()?.querySelector("[data-highlighted]")?.textContent).toBe("Sonnet 5");
  await userEvent.keyboard("h");
  await expect.poll(() => menu().query()?.querySelector("[data-highlighted]")?.textContent).toBe("high");
  await userEvent.keyboard("{Enter}");
  await expect.element(menu()).not.toBeInTheDocument();
  await expect.element(model()).toHaveFocus();
  await expect.element(model()).toHaveTextContent("Opus 5.5high");
  await expect.poll(sent).toEqual(["/effort high"]);
});

test("a draft stays for each agent over a switch to another agent, the Inbox and Settings, and a send clears it", async () => {
  const { calls } = await mountReply({
    overrides: { checkUpdate: async () => {}, checkCore: async () => {} },
  });
  const box = replyBox();
  await expect.element(box).toHaveAccessibleName("Reply to Chat panel usability audit");
  await box.fill("a draft for the audit");

  await notes().click();
  await expect.element(box).toHaveAccessibleName("Reply to Release notes draft");
  await expect.element(box).toHaveValue("");
  await box.fill("a draft for the notes");

  await page.getByRole("button", { name: /^Inbox/ }).click();
  await expect.element(box).not.toBeInTheDocument();
  const footer = page.elementLocator(document.querySelector("aside > footer")!);
  await footer.getByRole("button", { name: "Settings" }).click();
  await audit().click();
  await expect.element(box).toHaveAccessibleName("Reply to Chat panel usability audit");
  await expect.element(box).toHaveValue("a draft for the audit");
  await notes().click();
  await expect.element(box).toHaveValue("a draft for the notes");

  await clickSend();
  await expect.poll(() => calls).toEqual([{ terminal: "t11", text: "a draft for the notes" }]);
  await expect.element(box).toHaveValue("");
  await audit().click();
  await expect.element(box).toHaveValue("a draft for the audit");
  await notes().click();
  await expect.element(box).toHaveAccessibleName("Reply to Release notes draft");
  await expect.element(box).toHaveValue("");
});

test("a message that is not sent stays in the box over a switch to another agent", async () => {
  await mountReply({ sends: [{ ok: false, message: sendError }] });
  await replyBox().fill("this send fails");
  await clickSend();
  await containsText(replyForm().getByRole("alert")).toContain("Not sent");
  await notes().click();
  await expect.element(replyBox()).toHaveAccessibleName("Reply to Release notes draft");
  await audit().click();
  await expect.element(replyBox()).toHaveValue("this send fails");
});

test("the box grows with its text up to 40% of the window, then scrolls, and shrinks after a send", async () => {
  await mountReply();
  const box = replyBox();
  const size = () => {
    const el = box.element();
    return { height: el.clientHeight, scroll: el.scrollHeight, limit: Math.floor(window.innerHeight * 0.4) };
  };
  await expect.element(box).toBeVisible();
  const empty = size().height;

  await box.fill(["one", "two", "three", "four", "five"].join("\n"));
  await expect.poll(() => size().height).toBeGreaterThan(empty);
  const five = size();
  expect(five.scroll).toBe(five.height);

  await box.fill(Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"));
  await expect.poll(() => size().height).toBe(five.limit);
  const full = size();
  expect(full.scroll).toBeGreaterThan(full.height);
  await shoot("reply-grown");

  await clickSend();
  await expect.element(box).toHaveValue("");
  await expect.poll(() => size().height).toBe(empty);
});

test("in a 900x600 window the status line and the reply box keep 16 px of side space, as the chat rows do", async () => {
  await mountReply();
  await page.viewport(900, 600);
  expect(window.innerWidth).toBe(900);
  const status = statusLine();
  await containsText(status).toContain("Orchestrating · 3 workers");
  await containsText(status).toContain("Hashing…35s · ↓ 1.2k tokens");
  const main = page.getByRole("main").element().getBoundingClientRect();
  for (const part of [status, replyForm()]) {
    const b = part.element().getBoundingClientRect();
    expect(b.x - main.x).toBeGreaterThanOrEqual(16);
    expect(main.right - b.right).toBeGreaterThanOrEqual(16);
  }
  await shoot("reply-narrow");
});

test("in a narrow window the status line keeps its verb whole, cuts the detail with an ellipsis and keeps the orchestrator text", async () => {
  await mountReply();
  await page.viewport(640, 600);
  expect(window.innerWidth).toBe(640);
  const status = statusLine();
  await containsText(status).toContain("Hashing…");
  const right = status.getByText("Orchestrating · 3 workers");
  const fits = (el: Element) => el.scrollWidth <= el.clientWidth;
  await expect.poll(() => right.query() && fits(right.element())).toBe(true);
  const line = status.element().getBoundingClientRect();
  const r = right.element().getBoundingClientRect();
  expect(r.right).toBeLessThanOrEqual(line.right);
  expect(fits(status.getByText("Hashing…", { exact: true }).element())).toBe(true);
  const detail = status.getByText(/tokens/).element();
  expect(getComputedStyle(detail).textOverflow).toBe("ellipsis");
  expect(detail.scrollWidth).toBeGreaterThan(detail.clientWidth);
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await status.screenshot({ path: `../../../../tmp/shots/browser/status-narrow-${scheme}.png` });
  }
});
