import { expect, test } from "vitest";
import { page } from "vitest/browser";
import fixture from "../../e2e/fixtures/digest-session.jsonl?raw";
import { chatRow, normalizedText } from "../../test/273-chatRows";
import { shoot, textOf } from "../../test/280-browser";
import { renderApp } from "../../test/renderApp";
import { parseOwnerOpen } from "../main/owner/owner";
import type { Digest } from "../shared/api";

const counts: Digest = { since: 1793667720000, merged: 2, busy: 1, waiting: 2, failing: 1 };

const owner = parseOwnerOpen(JSON.stringify([
  { id: "D7", coordinator: "hc:t7", title: "Block or row?", from: "b-40", question: "Block or row?", options: ["Block", "Row"] },
  { id: "T3", kind: "todo", coordinator: "t7", from: "lead", text: "Run the staging e2e" },
  { id: "D9", coordinator: "t12", title: "Other", from: "b-30", question: "Not this chat", options: ["Yes"] },
]));

test("the digest shows the counts and time span; a block with text stays code", async () => {
  await renderApp(fixture, null, { digest: async () => counts, owner: async () => owner });
  const row = await chatRow("r1");
  const digest = page.elementLocator(row).getByRole("region", { name: "Since you left" });
  await expect.element(digest).toBeVisible();
  expect(digest.elements()).toHaveLength(1);
  expect(Array.from(digest.element().querySelectorAll("[data-cell]"), normalizedText)).toEqual([
    "2PRs merged", "1worker busy", "2wait for you", "1CI failure",
  ]);
  const from = new Date(counts.since!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  await expect.poll(() => textOf(digest.getByTestId("digest-span"))).toMatch(new RegExp(`^${from} → \\d\\d:\\d\\d$`));
  const color = (cell: string) => getComputedStyle(digest.element().querySelector(`[data-cell=${cell}] span`)!).color;
  expect(color("waiting")).toBe("rgb(240, 113, 120)");
  expect(color("merged")).toBe("rgb(244, 244, 245)");
  const code = row.querySelectorAll("pre");
  expect(code).toHaveLength(1);
  expect(normalizedText(code[0])).toContain("last 3h");
  row.scrollIntoView({ block: "nearest" });
  await shoot("digest");
});
