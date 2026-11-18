import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chatRow } from "./chat";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const e2e = import.meta.dirname;
/** The owner's message before the last one in fixtures/digest-session.jsonl: the time the owner left. */
const LEFT_AT = 1793667720000;

test("contr-digest shows the counts from gh and the orchestration tool; a block with text stays code", async () => {
  test.setTimeout(60_000);
  const tmp = mkdtempSync(path.join(os.tmpdir(), "contr-digest-"));
  const owner = path.join(tmp, "owner.json");
  writeFileSync(owner, JSON.stringify([
    { id: "D7", coordinator: "hc:t7", title: "Block or row?", from: "b-40", question: "Block or row?", options: ["Block", "Row"] },
    { id: "T3", kind: "todo", coordinator: "t7", from: "lead", text: "Run the staging e2e" },
    { id: "D9", coordinator: "t12", title: "Other", from: "b-30", question: "Not this chat", options: ["Yes"] },
  ]));
  const prLog = path.join(tmp, "gh-pr.log");
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/digest-session.jsonl"),
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_GH: path.join(e2e, "fake-gh.mjs"),
    FAKE_GH_PR_LOG: prLog,
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    FAKE_ORCH_OWNER: owner,
    CONTR_REPO_DIR: e2e,
    CONTR_TERMINAL: "t7",
  });
  const page = await app.firstWindow();
  const row = await chatRow(page, "r1");

  const digest = row.getByRole("region", { name: "Since you left" });
  await expect(digest).toHaveCount(1);
  // gh: #12 and #70 merged, #51 has a failed check. The tool: b-30 is the one working worker of t7; D7 and T3 are t7's items.
  await expect(digest.locator("[data-cell]")).toHaveText(["2PRs merged", "1worker busy", "2wait for you", "1CI failure"]);
  const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  await expect(digest.getByTestId("digest-span")).toHaveText(new RegExp(`^${hhmm(LEFT_AT)} → \\d\\d:\\d\\d$`));
  // gh searches the merges from the owner's message before the last one.
  expect(readFileSync(prLog, "utf8")).toContain(`merged:>=${new Date(LEFT_AT).toISOString().replace(/\.\d{3}Z$/, "Z")}`);

  // Red only for the count that waits for the owner.
  const color = (cell: string) => digest.locator(`[data-cell=${cell}] span`).first().evaluate((el) => getComputedStyle(el).color);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await color("waiting")).toBe("rgb(240, 113, 120)");
  expect(await color("merged")).toBe("rgb(244, 244, 245)");

  // The block with text shows as code.
  await expect(row.locator("pre")).toHaveCount(1);
  await expect(row.locator("pre")).toContainText("last 3h");

  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, `digest-${scheme}.png`) });
  }
  await app.close();
});
