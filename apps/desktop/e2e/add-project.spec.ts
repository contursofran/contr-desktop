import { expect, test } from "@playwright/test";
import type { BaseWindow, OpenDialogOptions } from "electron";
import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { ElectronApplication } from "@playwright/test";
import { launchApp } from "./launch";

async function chooseFolders(app: ElectronApplication, folders: (string | null)[]) {
  await app.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async (first: BaseWindow | OpenDialogOptions, second?: OpenDialogOptions) => {
      const options = second ?? first as OpenDialogOptions;
      if (!options.properties?.includes("openDirectory")) throw new Error("Expected a folder picker.");
      const folder = paths.shift();
      return { canceled: folder == null, filePaths: folder ? [folder] : [] };
    };
  }, folders);
}

test("Add project saves an empty folder and New tab uses the selected project", async () => {
  const info = test.info();
  const data = info.outputPath("profile");
  const log = info.outputPath("hc-run.jsonl");
  const folders = ["Drafts", "Release"].map((name) => info.outputPath(name));
  for (const dir of [data, ...folders]) mkdirSync(dir, { recursive: true });
  const env = { CONTR_TERMINAL: "", FAKE_HC_RUN_LOG: log };
  const app = await launchApp(env, data);
  try {
    await chooseFolders(app, [null, ...folders, folders[0]]);
    const page = await app.firstWindow();
    const projects = page.getByRole("navigation", { name: "Projects" });
    const add = projects.getByRole("button", { name: "Add project" });
    const drafts = projects.getByRole("button", { name: "Select project Drafts" });
    const release = projects.getByRole("button", { name: "Select project Release" });
    await add.click();
    await expect(add).toBeEnabled();
    await expect(projects.getByText("No agents", { exact: true })).toBeVisible();
    await add.click();
    await expect(drafts).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("No agents in Drafts")).toBeVisible();

    await add.click();
    await expect(release).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("No agents in Release")).toBeVisible();
    await add.click();
    await expect(drafts).toHaveAttribute("aria-current", "true");
    await expect(drafts).toHaveCount(1);
    await page.evaluate(() => window.contr.setTheme("light"));
    await page.screenshot({ path: path.resolve(import.meta.dirname, "../../../tmp/shots/346-add-project.png") });
  } finally {
    await app.close();
  }

  const reopened = await launchApp(env, data);
  try {
    const page = await reopened.firstWindow();
    const projects = page.getByRole("navigation", { name: "Projects" });
    await expect(projects.getByRole("region", { name: "Drafts" })).toBeVisible();
    const release = projects.getByRole("button", { name: "Select project Release" });
    await release.click();
    await expect(release).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("menuitem", { name: "Claude Code" }).click();
    await expect(page.getByRole("tab", { name: "Claude Code", selected: true })).toBeVisible();
    const { params } = JSON.parse(readFileSync(log, "utf8").trim());
    expect(params).toMatchObject({ cwd: realpathSync(folders[1]), argv: ["claude"] });
  } finally {
    await reopened.close();
  }
});
