import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import bashPermission from "../../e2e/fixtures/cards/bash-permission.json";
import question from "../../e2e/fixtures/cards/question.json";
import multiQuestion from "../../e2e/fixtures/cards/multi-question.json";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { renderApp } from "../../test/renderApp";

const approval = { ...bashPermission, kind: "approval", answered: false } as const;
const single = { ...question, kind: "question", question: { ...question.question, delivery: "picker" } } as const;
const multi = { ...multiQuestion, kind: "question", question: { ...multiQuestion.question, delivery: "picker" } } as const;

test("in a 900x600 window a card keeps 16 px of side space, as the chat rows do", async () => {
  await renderApp(transcript, single);
  await page.viewport(900, 600);
  expect(window.innerWidth).toBe(900);
  const cardBox = page.getByRole("region", { name: "Question" });
  await expect.element(cardBox).toBeVisible();
  const main = page.getByRole("main").element().getBoundingClientRect();
  const b = cardBox.element().getBoundingClientRect();
  expect(b.x - main.x).toBeGreaterThanOrEqual(16);
  expect(main.x + main.width - (b.x + b.width)).toBeGreaterThanOrEqual(16);
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await page.screenshot({ path: `../../../../tmp/shots/browser/card-narrow-${scheme}.png` });
  }
});

// The one question card (#182): the reply box's fill and line (`--side`, `--input-line`), no shadow, a red glyph.
test.each([
  { name: "Bash permission", card: approval, region: "Approval", keys: "1-2 pick  ⏎ send" },
  { name: "single choice", card: single, region: "Question", keys: "1-2 pick  ⏎ send" },
  { name: "pick any", card: multi, region: "Question", keys: "1-3 toggle  ⏎ next" },
])("permission, question and pick-any use the one card: fill, line, glyph, check boxes and keys line ($name)", async ({ card, region, keys }) => {
  await renderApp(transcript, card);
  const section = page.getByRole("region", { name: region });
  await expect.element(section).toBeVisible();
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    const probe = document.createElement("div");
    probe.style.cssText = "background: var(--side); border: 1px solid var(--input-line); color: var(--blocked)";
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const got = getComputedStyle(section.element());
    const glyph = getComputedStyle(section.element().querySelector('[data-state="blocked"]')!);
    try {
      expect(got.backgroundColor).toBe(want.backgroundColor);
      expect(got.borderTopColor).toBe(want.borderTopColor);
      expect(glyph.color).toBe(want.color);
      expect(got.boxShadow).toBe("none");
    } finally {
      probe.remove();
    }
  }
  expect(section.getByRole("img", { name: "Needs you" }).elements()).toHaveLength(1);
  expect(section.element().textContent?.replaceAll(/\s+/g, " ")).toContain(keys.replaceAll(/\s+/g, " "));
  // The card head shows the agent's name and title and the card's age.
  expect(page.getByRole("navigation", { name: "Projects" }).element().textContent).toContain("Chat panel usability audit");
  await expect.poll(() => section.element().querySelector("p")?.textContent).toMatch(/^orch-contr-desktopChat panel usability audit · <1m · /);
  if (card === single) {
    const detail = getComputedStyle(section.getByText("Lost when the window closes").element());
    expect(detail.fontSize).toBe("12px");
    expect(detail.lineHeight).toBe("17px");
    expect(detail.fontFamily).not.toMatch(/mono/i);
  }
  if (card === multi) {
    expect(section.getByRole("checkbox", { name: "Typecheck", exact: true }).element().textContent).toBe("Typechecktsc --noEmit");
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true, cancelable: true }));
    const lint = section.getByRole("checkbox", { name: "Lint", exact: true });
    await expect.element(lint).toBeChecked();
    expect(lint.element().querySelectorAll("svg")).toHaveLength(1);
  }
  if (region === "Question") {
    await expect.element(section.getByRole("textbox", { name: "Own answer" })).toHaveAttribute("placeholder", "Or type an answer");
  }
});
