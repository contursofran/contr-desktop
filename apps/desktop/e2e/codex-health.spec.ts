import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CODEX_ORCHESTRATION_RULE } from "../src/shared/codex-rule";
import { launchApp } from "./launch";

test("Settings checks the active global Codex rule again after the file changes", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-codex-"));
  const data = path.join(home, "app");
  const standard = path.join(home, "AGENTS.md");
  const override = path.join(home, "AGENTS.override.md");
  try {
    const app = await launchApp({ CODEX_HOME: home }, data);
    try {
      const page = await app.firstWindow();
      await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
      const health = page.getByRole("region", { name: "Health check" });
      await health.getByRole("button", { name: "Check now" }).click();
      await expect(health.getByRole("status")).toHaveText("Rule missing");
      await expect(health.getByLabel("Codex instructions file")).toHaveText(standard);
      await expect(health.getByRole("button", { name: "Copy rule" })).toBeVisible();

      writeFileSync(standard, CODEX_ORCHESTRATION_RULE);
      await health.getByRole("button", { name: "Check again" }).click();
      await expect(health.getByRole("status")).toHaveText("Rule found");
      await expect(health.getByRole("button", { name: "Copy rule" })).toHaveCount(0);

      writeFileSync(override, "# Instructions\n");
      await health.getByRole("button", { name: "Check again" }).click();
      await expect(health.getByRole("status")).toHaveText("Rule missing");
      await expect(health.getByLabel("Codex instructions file")).toHaveText(override);
    } finally {
      await app.close();
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
