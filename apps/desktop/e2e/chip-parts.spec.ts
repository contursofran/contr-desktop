import { expect, test } from "@playwright/test";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DecisionChip } from "../src/renderer/chat/refs/DecisionChip";
import { FileChip } from "../src/renderer/chat/refs/FileChip";
import { OwnerChip } from "../src/renderer/chat/refs/OwnerChip";
import { WorkerChip } from "../src/renderer/chat/refs/WorkerChip";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;

// No chat part uses these chips yet (the board, the queue and the PR card will). The test puts their markup
// in a chat row of the real window, so the app's CSS and theme tokens draw them.
const parts = renderToStaticMarkup(
  h("p", { "data-chip-parts": "" },
    h(WorkerChip, { name: "b-31", state: "working" }), " ", h(WorkerChip, { name: "b-41", state: "blocked" }), " ",
    h(WorkerChip, { name: "b-60", state: "idle" }), " ",
    h(OwnerChip, { item: { id: "D7", coordinator: "t7", order: 0, title: "Block or row?", from: "b-15", question: "?", options: [], refs: [] }, open: true }), " ",
    h(OwnerChip, { item: { id: "T3", coordinator: "t7", order: 1, from: "b-15", text: "Log in", know: false }, open: true }), " ",
    h(DecisionChip, { id: "D112" }), " ", h(FileChip, { path: "e2e/keys.spec.ts:88" }),
  ),
);

test("worker, owner item, decision and file chips draw with the theme tokens", async () => {
  const app = await launchApp({ CONTR_HELPER: path.join(e2e, "fake-helper.mjs"), FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl") });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const row = await chatRow(page, "a3");
  await row.evaluate((el, html) => el.insertAdjacentHTML("beforeend", html), parts);
  const chips = row.locator("[data-chip-parts] [data-slot=context-chip]");
  await expect(chips).toHaveText(["b-31", "b-41", "b-60", "D7Block or row?", "T3", "D112", "e2e/keys.spec.ts:88"]);
  const style = (n: number, prop: "boxShadow" | "color") => chips.nth(n).evaluate((e, p) => getComputedStyle(e)[p], prop);
  // Red only on what waits for the owner; the rest have the hairline outline and ink.
  expect(await style(3, "boxShadow")).toContain("color(srgb 0.941176 0.443137 0.470588 / 0.35) 0px 0px 0px 1px inset");
  expect(await style(4, "boxShadow")).toContain("color(srgb 0.941176 0.443137 0.470588 / 0.35) 0px 0px 0px 1px inset");
  for (const n of [0, 5, 6]) expect(await style(n, "boxShadow")).toContain("rgba(255, 255, 255, 0.06) 0px 0px 0px 1px inset");
  expect(await style(5, "color")).toBe("rgb(244, 244, 245)");
  expect(await chips.nth(1).locator(".status-glyph").evaluate((e) => getComputedStyle(e).color)).toBe("rgb(240, 113, 120)");
  // In the middle of the list, away from the button that jumps to the end.
  await row.locator("[data-chip-parts]").evaluate((e) => e.scrollIntoView({ block: "center" }));
  await row.locator("[data-chip-parts]").screenshot({ path: path.join(shots, "chip-parts-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => style(5, "color")).toBe("rgb(20, 20, 20)");
  expect(await style(5, "boxShadow")).toContain("rgba(0, 0, 0, 0.07) 0px 0px 0px 1px inset");
  await row.locator("[data-chip-parts]").screenshot({ path: path.join(shots, "chip-parts-light.png") });
  await app.close();
});
