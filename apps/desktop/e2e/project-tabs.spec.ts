import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { launchApp } from "./launch";

const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");

test("project tabs follow the sidebar, keep separate orders and closures, and limit number keys", async () => {
  test.setTimeout(60_000);
  const info = test.info();
  const profile = info.outputPath("profile");
  mkdirSync(profile, { recursive: true });
  const list = info.outputPath("terminals.json");
  writeFileSync(list, JSON.stringify({
    terminals: [
      ["t7", "Chat panel usability audit", "/work/contr-desktop"],
      ["t11", "Release notes draft", "/work/contr-desktop"],
      ["t15", "Project handoff", "/work/contr-desktop"],
      ["t12", "Install health check", "/work/herdr-contr"],
      ["t14", "Runner diagnostics", "/work/herdr-contr"],
    ].map(([address, title, cwd]) => ({ address, title, cwd, agent: "claude-code", state: "live", status: "idle" })),
  }));
  const env = { CONTR_TERMINAL: "t7", FAKE_HC_LIST: list };
  const [a, b, c, d] = ["Chat panel usability audit", "Release notes draft", "Install health check", "Runner diagnostics"];
  const handoff = "Project handoff";
  const number = process.platform === "darwin" ? "Meta" : "Control";

  const app = await launchApp(env, profile);
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1100, 750));
    const sidebar = page.getByRole("navigation", { name: "Projects" });
    const tabs = page.getByRole("tablist", { name: "Tabs" });
    const shown = tabs.getByRole("tab", { selected: true });
    await sidebar.getByRole("button", { name: a }).click();
    await expect(tabs.getByRole("tab")).toHaveText([a, b, handoff]);
    await tabs.getByRole("tab", { name: a }).press("Alt+ArrowRight");
    await expect(tabs.getByRole("tab")).toHaveText([b, a, handoff]);

    await sidebar.getByRole("button", { name: c }).click();
    await expect(tabs.getByRole("tab")).toHaveText([c, d]);
    await page.keyboard.press(`${number}+2`);
    await expect(shown).toHaveText(d);
    await page.keyboard.press(`${number}+3`);
    await expect(shown).toHaveText(d);
    await tabs.getByRole("tab", { name: d }).press("Alt+ArrowLeft");
    await expect(tabs.getByRole("tab")).toHaveText([d, c]);

    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({ path: path.join(shots, `335-project-tabs-${scheme}.png`) });
    }
    await sidebar.getByRole("button", { name: a }).click();
    await expect(tabs.getByRole("tab")).toHaveText([b, a, handoff]);
    await sidebar.getByRole("button", { name: handoff }).click();
    await page.getByRole("button", { name: `Close ${handoff}` }).click();
    await expect(shown).toHaveText(a);
  } finally {
    await app.close();
  }

  const restarted = await launchApp(env, profile);
  try {
    const page = await restarted.firstWindow();
    const sidebar = page.getByRole("navigation", { name: "Projects" });
    const tabs = page.getByRole("tablist", { name: "Tabs" });
    await expect(tabs.getByRole("tab")).toHaveText([b, a]);
    await sidebar.getByRole("button", { name: d }).click();
    await expect(tabs.getByRole("tab")).toHaveText([d, c]);
    await page.keyboard.press(`${number}+2`);
    await expect(tabs.getByRole("tab", { selected: true })).toHaveText(c);
  } finally {
    await restarted.close();
  }
});
