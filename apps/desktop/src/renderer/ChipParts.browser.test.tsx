import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { browserShots, chatRow, normalizedText } from "../../test/273-chatRows";
import { renderApp } from "../../test/renderApp";
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
  const group = row.querySelector("[data-chip-parts]")!;
  const chips = Array.from(group.querySelectorAll("[data-slot=context-chip]"));
  expect(chips.map(normalizedText)).toEqual(["b-31", "b-41", "b-60", "b-70", "D7Block or row?", "T3", "D112", "e2e/keys.spec.ts:88"]);
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
});
