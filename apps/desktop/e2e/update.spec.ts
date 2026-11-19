import { expect, test } from "@playwright/test";
import { Arch, build, Platform } from "electron-builder";
import { chmodSync, createReadStream, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const base = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};
const DMG = Buffer.alloc(64 * 1024, 7);
const require = createRequire(import.meta.url);
let project = "";
let zip = "";

/**
 * Builds the release .zip as `pnpm dist` does: electron-builder with electron-builder.yml, so the app is signed
 * with the release's signing options (#87). Only the content and the build speed differ: a small main file,
 * the local arch, no compression and the local Electron.
 */
async function releaseZip(version: string): Promise<string> {
  project = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-release-"));
  writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "desktop", version, main: "main.js" }));
  writeFileSync(path.join(project, "main.js"), "process.exit(0);\n");
  // The scratch project has no dependencies; a lockfile makes electron-builder list them with npm, not with
  // the package manager that runs the tests.
  writeFileSync(path.join(project, "package-lock.json"), JSON.stringify({ name: "desktop", version, lockfileVersion: 3, packages: {} }));
  // On a pull_request run (GITHUB_BASE_REF is set) electron-builder skips signing; the release runs on
  // workflow_run and signs. CSC_FOR_PULL_REQUEST makes this build sign as the release does.
  const pr = process.env.CSC_FOR_PULL_REQUEST;
  process.env.CSC_FOR_PULL_REQUEST = "true";
  await build({
    projectDir: project,
    targets: Platform.MAC.createTarget(["zip"], process.arch === "x64" ? Arch.x64 : Arch.arm64),
    config: {
      extends: path.resolve(e2e, "../electron-builder.yml"),
      directories: { output: path.join(project, "release") },
      electronDist: path.dirname(require.resolve("electron/dist/version")),
      electronVersion: (require("electron/package.json") as { version: string }).version,
      files: ["main.js"],
      compression: "store",
      npmRebuild: false,
    },
  }).finally(() => {
    if (pr === undefined) delete process.env.CSC_FOR_PULL_REQUEST;
    else process.env.CSC_FOR_PULL_REQUEST = pr;
  });
  return path.join(project, "release/contr-mac-universal.zip");
}

test.beforeAll(async () => {
  // electron-builder signs only on macOS; the Update button installs only there.
  test.skip(process.platform !== "darwin", "macOS only: codesign and ditto");
  test.setTimeout(180_000);
  zip = await releaseZip("9.1.42");
});

test.afterAll(() => {
  if (project) rmSync(project, { recursive: true, force: true });
});

/** The release version that /live returns. */
const live = { version: "0.0.0" };

/** A fake GitHub: /live (see `live`), /release (the release JSON, its .zip broken), /release-zip, /release-dmg (no .zip), /dmg (a small fake .dmg), /zip (the app as the release build makes it), /broken (HTTP 500). */
async function fakeGitHub(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    if (req.url === "/live") {
      res.end(JSON.stringify({ body: `contr ${live.version} from abc.`, assets: [{ name: "contr-mac-universal.dmg", browser_download_url: `${url}/dmg` }] }));
    } else if (req.url === "/release") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ name: "build-2026-11-16-abc1234", body: "contr 9.1.42 from abc1234.", assets: [{ name: "contr-mac-universal.dmg", browser_download_url: `${url}/dmg` }, { name: "contr-mac-universal.zip", browser_download_url: `${url}/broken` }] }));
    } else if (req.url === "/release-bad-dmg") {
      res.end(JSON.stringify({ body: "contr 9.1.42 from abc.", assets: [{ name: "contr-mac-universal.dmg", browser_download_url: `${url}/broken` }] }));
    } else if (req.url === "/release-dmg") {
      res.end(JSON.stringify({ body: "contr 9.1.42 from abc.", assets: [{ name: "contr-mac-universal.dmg", browser_download_url: `${url}/dmg` }] }));
    } else if (req.url === "/release-zip") {
      res.end(JSON.stringify({ body: "contr 9.1.42 from abc.", assets: [{ name: "contr-mac-universal.dmg", browser_download_url: `${url}/dmg` }, { name: "contr-mac-universal.zip", browser_download_url: `${url}/zip` }] }));
    } else if (req.url === "/zip") {
      res.setHeader("content-length", String(statSync(zip).size));
      createReadStream(zip).pipe(res);
    } else if (req.url === "/dmg") {
      res.setHeader("content-length", String(DMG.length));
      res.end(DMG);
    } else {
      res.statusCode = 500;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const openSettings = async (page: import("@playwright/test").Page) => {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" });
};

test("dev and e2e with no release URL show Development build and no Update button", async () => {
  const app = await launchApp(base);
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Current version")).toHaveText("0.0.0");
  await expect(view.getByLabel("Newest version")).toHaveText("Development build");
  await expect(view.getByRole("button", { name: "Update" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Check now" })).toHaveCount(0);
  await expect(page.getByLabel("Update ready")).toHaveCount(0);
  await app.close();
});

test("Update downloads the .dmg for a newer release", async () => {
  const { server, url } = await fakeGitHub();
  const downloads = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-downloads-"));
  const app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/release`, CONTR_DOWNLOADS: downloads });
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await view.getByRole("button", { name: "Update" }).click();
  const file = path.join(downloads, "contr-mac-universal.dmg");
  // The file name, not its folder: no local path in a text.
  await expect(view.getByRole("status")).toHaveText("Opened contr-mac-universal.dmg. Drag contr to Applications.");
  expect(readFileSync(file).equals(DMG)).toBe(true);
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "update-done-light.png") });
  await app.close();
  server.close();
});

test("a failed check and a failed download show their message", async () => {
  const { server, url } = await fakeGitHub();
  let app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/nothing` });
  let page = await app.firstWindow();
  let view = await openSettings(page);
  await expect(view.getByRole("alert")).toHaveText("Update check failed: HTTP 500");
  await app.close();

  app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/release-bad-dmg`, CONTR_DOWNLOADS: mkdtempSync(path.join(os.tmpdir(), "contr-e2e-downloads-")) });
  page = await app.firstWindow();
  view = await openSettings(page);
  await view.getByRole("button", { name: "Update" }).click();
  await expect(view.getByRole("alert")).toHaveText("Download failed: HTTP 500");
  await app.close();
  server.close();
});

test("with a writable app folder a press installs from the .zip and shows Restart to update", async () => {
  const { server, url } = await fakeGitHub();
  const install = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-install-"));
  const app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/release-zip`, CONTR_INSTALL_DIR: install });
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await view.getByRole("button", { name: "Update" }).click();
  const restart = view.getByRole("button", { name: "Restart to update" });
  // The press unpacks a real app and runs codesign on it: slow on a CI runner. A failed download shows its text here.
  await expect(restart.or(view.getByRole("alert"))).toBeVisible({ timeout: 60_000 });
  expect(await view.getByRole("alert").allTextContents()).toEqual([]);
  await expect(restart).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "update-restart-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "update-restart-light.png") });
  await restart.click();
  await expect(restart).toBeVisible();
  await app.close();
  server.close();
});

test("a read-only app folder or a release with no .zip falls back to the .dmg", async () => {
  const { server, url } = await fakeGitHub();
  const install = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-install-"));
  chmodSync(install, 0o555);
  for (const [release, dir] of [["release-zip", install], ["release-dmg", mkdtempSync(path.join(os.tmpdir(), "contr-e2e-install-"))]]) {
    const downloads = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-downloads-"));
    const app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/${release}`, CONTR_INSTALL_DIR: dir, CONTR_DOWNLOADS: downloads });
    const view = await openSettings(await app.firstWindow());
    await view.getByRole("button", { name: "Update" }).click();
    await expect(view.getByRole("status")).toHaveText("Opened contr-mac-universal.dmg. Drag contr to Applications.");
    expect(readFileSync(path.join(downloads, "contr-mac-universal.dmg")).equals(DMG)).toBe(true);
    await app.close();
  }
  chmodSync(install, 0o755);
  server.close();
});

test("Check now and the app menu's Check for Updates… show a new release with no restart", async () => {
  const { server, url } = await fakeGitHub();
  live.version = "0.0.0";
  const downloads = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-downloads-"));
  const app = await launchApp({ ...base, CONTR_UPDATE_URL: `${url}/live`, CONTR_DOWNLOADS: downloads });
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Newest version")).toHaveText("Up to date");
  live.version = "9.1.42";
  await view.getByRole("button", { name: "Check now" }).click();
  await expect(view.getByLabel("Newest version")).toHaveText("9.1.42");

  await view.getByRole("button", { name: "Update" }).click();
  await expect(view.getByRole("status")).toHaveText("Opened contr-mac-universal.dmg. Drag contr to Applications.");
  expect(readFileSync(path.join(downloads, "contr-mac-universal.dmg")).equals(DMG)).toBe(true);
  live.version = "9.1.43";
  await view.getByRole("button", { name: "Check now" }).click();
  await expect(view.getByLabel("Newest version")).toHaveText("9.1.43");
  await expect(view.getByRole("status")).toHaveCount(0);

  live.version = "9.1.50";
  await page.getByRole("button", { name: "Inbox" }).click();
  await expect(view).toHaveCount(0);
  await expect((await openSettings(page)).getByLabel("Newest version")).toHaveText("9.1.50");

  // The app menu's item, clicked through the main process: it shows Settings and checks.
  live.version = "9.2.0";
  await page.getByRole("button", { name: "Inbox" }).click();
  await expect(view).toHaveCount(0);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("check-updates")?.click());
  await expect(page.getByRole("region", { name: "Settings" }).getByLabel("Newest version")).toHaveText("9.2.0");
  await app.close();
  server.close();
});
