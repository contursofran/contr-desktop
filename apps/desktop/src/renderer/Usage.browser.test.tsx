import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import transcript from "../../e2e/fixtures/claude-session.jsonl?raw";
import { renderApp } from "../../test/renderApp";
import { usageRows } from "../main/foot/usage";

test("a stale plan shows a dash and an empty meter, Codex's windows show as 5h and wk, and each row says when it was read", async () => {
  const now = Math.floor(Date.now() / 1000);
  const hoursFromNow = (hours: number) => now + hours * 3600 + 600;
  await renderApp(transcript, null, {
    // Use the same helper data as the stale Electron case, then apply main's usage conversion.
    usage: async () => usageRows([{ type: "usage", plans: [
      { plan: "claude", read_at: now - 2 * 86_400 - 600, windows: [
        { kind: "five_hour", used_percent: 12, resets_at: hoursFromNow(-40) },
        { kind: "seven_day", used_percent: 17, resets_at: hoursFromNow(-1) },
      ] },
      { plan: "codex", read_at: now - 2 * 3600 - 600, windows: [
        { kind: "primary", used_percent: 8, resets_at: hoursFromNow(3) },
        { kind: "secondary", used_percent: 33.2, resets_at: hoursFromNow(100) },
      ] },
    ] }], now),
  });
  const usage = page.getByRole("list", { name: "Plan usage" });
  await expect.poll(() => usage.getByRole("listitem").elements().map((row) => row.textContent))
    .toEqual(["Claude—", "Codex33% wk · 4d"]);
  const claude = usage.getByRole("meter", { name: "Claude usage" });
  await expect.element(claude).not.toHaveAttribute("aria-valuenow");
  await expect.element(claude).toHaveAttribute("aria-valuetext", "No current data");
  expect(claude.element().querySelector("span")!.getBoundingClientRect().width).toBe(0);
  await expect.element(usage.getByRole("meter", { name: "Codex usage" })).toHaveAttribute("aria-valuenow", "33");

  for (const [plan, tip, shot] of [
    ["Claude", "No current data. Last read 2d ago.", "usage-stale"],
    ["Codex", "Read 2h ago", "usage-codex"],
  ] as const) {
    await usage.getByRole("listitem", { name: plan }).hover();
    await expect.element(page.getByRole("tooltip")).toHaveTextContent(tip);
    for (const scheme of ["dark", "light"] as const) {
      await commands.colorScheme(scheme);
      await page.screenshot({ path: `../../../../tmp/shots/browser/${shot}-${scheme}.png` });
    }
  }
});
