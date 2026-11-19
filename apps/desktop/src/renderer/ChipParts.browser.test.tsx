import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import blocks from "../../e2e/fixtures/blocks-session.jsonl?raw";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots, chatRow, normalizedText } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";
import type { Board, ContrApi, OwnerQuestion } from "../shared/api";
import { DecisionChip } from "./chat/refs/DecisionChip";
import { FileChip } from "./chat/refs/FileChip";
import { OwnerChip } from "./chat/refs/OwnerChip";
import { WorkerChip } from "./chat/refs/WorkerChip";

// Put the chip markup in a chat row so the app's CSS and theme tokens draw it.
const parts = renderToStaticMarkup(
  <p data-chip-parts="">
    <WorkerChip name="b-31" state="working" />{" "}
    <WorkerChip name="b-41" state="blocked" />{" "}
    <WorkerChip name="b-60" state="idle" />{" "}
    <WorkerChip name="b-70" state="done" />{" "}
    <OwnerChip item={{ id: "D7", coordinator: "t7", order: 0, title: "Block or row?", from: "b-15", question: "?", options: [], refs: [] }} open />{" "}
    <OwnerChip item={{ id: "T3", coordinator: "t7", order: 1, from: "b-15", text: "Log in", know: false }} open />{" "}
    <DecisionChip id="D112" />{" "}
    <FileChip path="e2e/keys.spec.ts:88" />
  </p>,
);

test("worker, owner item, decision and file chips draw with the theme tokens", async () => {
  await renderApp(transcript);
  await commands.colorScheme("dark");
  const row = await chatRow("a3");
  row.insertAdjacentHTML("beforeend", parts);
  const group = row.querySelector<HTMLParagraphElement>("[data-chip-parts]")!;
  const chips = Array.from(group.querySelectorAll("[data-slot=context-chip]"));
  expect(chips.map(normalizedText)).toEqual(["b-31", "b-41", "b-60", "b-70", "D7Block or row?", "T3", "D112", "e2e/keys.spec.ts:88"]);
  expect(group.querySelector("[data-decision]")!.tagName).toBe("SPAN");
  expect(group.querySelector("[data-file]")!.tagName).toBe("SPAN");
  const style = (n: number) => getComputedStyle(chips[n]!);
  // Red only on what waits for the owner; the rest have the hairline outline and ink.
  expect(style(4).boxShadow).toContain("color(srgb 0.941176 0.443137 0.470588 / 0.35) 0px 0px 0px 1px inset");
  expect(style(5).boxShadow).toContain("color(srgb 0.941176 0.443137 0.470588 / 0.35) 0px 0px 0px 1px inset");
  for (const n of [0, 3, 6, 7]) expect(style(n).boxShadow).toContain("rgba(255, 255, 255, 0.06) 0px 0px 0px 1px inset");
  expect(style(6).color).toBe("rgb(244, 244, 245)");
  expect(getComputedStyle(chips[1]!.querySelector(".status-glyph")!).color).toBe("rgb(240, 113, 120)");
  const done = group.querySelector('[data-worker-state="done"] [data-state="done"]');
  expect(done?.getAttribute("aria-label")).toBe("Done");
  const doneGlyph = () => getComputedStyle(done!, "::before");
  expect(doneGlyph().content).toBe('"⠿"');
  expect(doneGlyph().animationName).toBe("none");
  expect(doneGlyph().color).toBe("rgba(255, 255, 255, 0.42)");
  // In the middle of the list, away from the button that jumps to the end.
  group.scrollIntoView({ block: "center" });
  await page.elementLocator(group).screenshot({ path: `${browserShots}/chip-parts-dark.png` });
  await commands.colorScheme("light");
  await expect.poll(() => style(6).color).toBe("rgb(20, 20, 20)");
  expect(style(6).boxShadow).toContain("rgba(0, 0, 0, 0.07) 0px 0px 0px 1px inset");
  expect(doneGlyph().color).toBe("rgba(0, 0, 0, 0.514)");
  await page.elementLocator(group).screenshot({ path: `${browserShots}/chip-parts-light.png` });

  // Keep the three worker states together and enlarge them for the chat-row screenshots.
  group.replaceChildren(chips[0]!, " ", chips[1]!, " ", chips[3]!);
  group.style.zoom = "2";
  group.scrollIntoView({ block: "center" });
  const chat = page.elementLocator(row);
  await chat.screenshot({ path: `${browserShots}/worker-states-light.png` });
  await commands.colorScheme("dark");
  await expect.poll(() => doneGlyph().color).toBe("rgba(255, 255, 255, 0.42)");
  await chat.screenshot({ path: `${browserShots}/worker-states-dark.png` });
});

const board: Board = {
  agent: "t7", workers: { "b-30": "working", "b-40": "blocked" }, roles: {}, checks: {}, orchestrating: 2,
};

test.each(["click", "Enter"])("a worker chip opens its chat by %s", async (activation) => {
  const select = vi.fn<ContrApi["select"]>(async (terminal) => terminal);
  await renderApp(blocks, null, { board: async () => board, select });
  const row = await chatRow("r2");
  const chip = page.elementLocator(row).getByRole("button", { name: "Worker b-30, working" });
  if (activation === "click") await chip.click();
  else {
    (await chip.findElement()).focus();
    await userEvent.keyboard("{Enter}");
  }
  await expect.element(page.getByRole("textbox", { name: "Reply to Install health check" })).toBeVisible();
  expect(select.mock.calls).toEqual([["t8"]]);
});

test("a worker without a chat keeps its status chip", async () => {
  const select = vi.fn<ContrApi["select"]>();
  await renderApp(blocks, null, {
    board: async () => ({ ...board, workers: { "b-30": "done" } }),
    sidebar: async () => ({ selected: "t7", projects: [] }),
    select,
  });
  const row = await chatRow("r2");
  const chip = page.elementLocator(row).getByLabelText("Worker b-30, done");
  await expect.element(chip.getByRole("img", { name: "Done" })).toBeVisible();
  expect(chip.element().tagName).toBe("SPAN");
  expect(select).not.toHaveBeenCalled();
});

const question: OwnerQuestion = {
  id: "D7", coordinator: "t7", order: 1, title: "Queue block or row", from: "b-40",
  question: "Is the merge queue a block or a row?", options: [{ label: "Block", impact: "", recommended: true }, { label: "Row", impact: "", recommended: false }], refs: [],
};

test.each([["click", "dark"], ["Enter", "light"]] as const)("an owner item chip opens its Inbox row by %s", async (activation, theme) => {
  const owner = vi.fn<ContrApi["owner"]>(async () => ({
    questions: [{ ...question, id: "D1", order: 0, coordinator: "t12", question: "An older question" }, question],
    todos: [],
  }));
  const answer = vi.fn<ContrApi["ownerAnswer"]>();
  await renderApp(blocks, null, { board: async () => board, owner, ownerAnswer: answer });
  await commands.colorScheme(theme);
  const row = await chatRow("r1");
  const chip = page.elementLocator(row).getByRole("button", { name: "Question D7, Queue block or row, open" });
  if (activation === "click") await chip.click();
  else {
    (await chip.findElement()).focus();
    await userEvent.keyboard("{Enter}");
  }
  const inbox = page.getByRole("region", { name: "Inbox" });
  const open = inbox.getByRole("region", { name: "Owner question" });
  await expect.element(open).toHaveAttribute("data-item", "D7");
  await expect.element(open.getByText(question.question, { exact: true })).toBeVisible();
  await expect.element(inbox.getByRole("button", { name: /An older question/ })).toBeVisible();
  expect(owner).toHaveBeenCalled();
  expect(answer).not.toHaveBeenCalled();
  await inbox.screenshot({ path: `${browserShots}/chip-inbox-${theme}.png` });
});
