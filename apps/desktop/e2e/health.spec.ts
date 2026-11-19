import { expect, test } from "@playwright/test";
import path from "node:path";
import { launchApp } from "./launch";

test("Settings shows health by computer and gives a fix for an unreachable machine", async () => {
  const app = await launchApp({ FAKE_HC_AGENTS: "1" });
  try {
    const page = await app.firstWindow();
    const button = page.getByRole("button", { name: "Settings" });
    await button.click();
    const health = page.getByRole("region", { name: "Health check" });
    await expect(health.getByRole("status")).toHaveText("3 of 5 pass · 1 warning · 1 failed");
    await expect(health.getByRole("region", { name: "aerum-pc" })).toContainText("Helper answers on aerum-pc.");
    const remote = health.getByRole("region", { name: "vps" });
    await remote.getByLabel("Connection · Failed").click();
    await expect(remote.getByText("Bring this computer online", { exact: false })).toBeVisible();
    await expect(button.getByLabel("Health check failed")).toBeVisible();
    await expect(health.getByRole("button", { name: "Copy report" })).toBeEnabled();
    await health.getByRole("button", { name: "Run again" }).click();
    await expect(health.getByRole("button", { name: "Run again" })).toBeEnabled();
    await health.getByRole("heading", { name: "Health check" }).evaluate((heading) => heading.scrollIntoView({ block: "start" }));
    const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: path.join(shots, "machine-health-dark.png") });
    await page.emulateMedia({ colorScheme: "light" });
    await page.screenshot({ path: path.join(shots, "machine-health-light.png") });
  } finally {
    await app.close();
  }
});
