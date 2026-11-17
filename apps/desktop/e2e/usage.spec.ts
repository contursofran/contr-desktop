import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

test("a stale plan shows a dash and an empty meter, Codex's windows show as 5h and wk, and each row says when it was read", async () => {
  test.setTimeout(60_000);
  const app = await launchApp({
    CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_USAGE: "stale",
    CONTR_TERMINAL: "t7",
    CONTR_HC: path.join(e2e, "fake-hc.mjs"),
    FAKE_HC_AGENTS: "1",
    CONTR_ORCH: path.join(e2e, "fake-orch.mjs"),
    CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  });
  const page = await app.firstWindow();
  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect(usage.getByRole("listitem")).toHaveText(["Claude—", "Codex33% wk · 4d"]);
  const claude = usage.getByRole("meter", { name: "Claude usage" });
  await expect(claude).not.toHaveAttribute("aria-valuenow");
  await expect(claude).toHaveAttribute("aria-valuetext", "No current data");
  expect(await claude.locator("span").evaluate((e) => e.getBoundingClientRect().width)).toBe(0);
  await expect(usage.getByRole("meter", { name: "Codex usage" })).toHaveAttribute("aria-valuenow", "33");

  // The foot and the space above it, where the tooltip shows.
  const foot = (await page.locator("aside > footer").boundingBox())!;
  const clip = { x: 0, y: foot.y - 60, width: foot.width + 120, height: foot.height + 60 };
  await usage.getByRole("listitem", { name: "Claude" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("No current data. Last read 2d ago.");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `usage-stale-${scheme}.png`), clip });
  }
  await usage.getByRole("listitem", { name: "Codex" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Read 2h ago");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `usage-codex-${scheme}.png`), clip });
  }
  await app.close();
});
