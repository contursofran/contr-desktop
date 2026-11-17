import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
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
  CONTR_VERSION: "0.1.24",
};
const TAG = "build-2026-11-18-4444444";
const DMG = Buffer.alloc(16 * 1024, 7);
/** release.json as scripts/release-notes.mjs writes it. */
const FILE = {
  schema: 1,
  version: "0.1.30",
  tag: TAG,
  sha: "4444444",
  date: "2026-11-18T08:00:00Z",
  assets: ["contr-mac-universal.dmg"],
  releases: [
    { version: "0.1.30", tag: TAG, date: "2026-11-18", changes: ["Updates: read a release file, not the rate-limited API (#130)"] },
    { version: "0.1.24", tag: "build-2026-11-15-1111111", date: "2026-11-15", changes: ["Settings: the theme choice and the helper path (#60)"] },
  ],
};
/** The end of GitHub's limit in the fake 403 answer: 14:05 local time today. */
const RESET = new Date(new Date().setHours(14, 5, 0, 0));

/**
 * A fake github.com and api.github.com. /releases/latest/download/release.json answers as `file` says: the file,
 * 404 or a 403 of the rate limit. /releases/download/<TAG>/contr-mac-universal.dmg is a small fake .dmg.
 * /api/latest and /api/releases are the API (version 0.1.27). `paths` records each request.
 */
async function fakeGitHub(file: "ok" | 404 | 403): Promise<{ server: Server; url: string; paths: string[] }> {
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url ?? "");
    if (req.url === "/releases/latest/download/release.json") {
      if (file === 403) res.writeHead(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(RESET.getTime() / 1000) });
      else if (file === 404) res.statusCode = 404;
      res.end(file === "ok" ? JSON.stringify(FILE) : "");
    } else if (req.url === `/releases/download/${TAG}/contr-mac-universal.dmg`) {
      res.end(DMG);
    } else if (req.url === "/api/latest") {
      res.end(JSON.stringify({ body: "contr 0.1.27 from 8e9dfad.", assets: [] }));
    } else if (req.url === "/api/releases") {
      res.end(JSON.stringify([{ tag_name: "build-2026-11-17-8e9dfad", published_at: "2026-11-17T02:57:22Z", body: "contr 0.1.27 from 8e9dfad.\n\n## Changes\n\n- From the API (#110)\n" }]));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, paths };
}

const env = (url: string) => ({ ...base, CONTR_RELEASE_FILE_URL: `${url}/releases/latest/download/release.json`, CONTR_UPDATE_URL: `${url}/api/latest`, CONTR_RELEASES_URL: `${url}/api/releases` });

const openSettings = async (page: Page) => {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" });
};

test("one read of release.json gives the newest release and the change log; the .dmg comes from releases/download/<tag>/", async () => {
  const { server, url, paths } = await fakeGitHub("ok");
  const downloads = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-downloads-"));
  const app = await launchApp({ ...env(url), CONTR_DOWNLOADS: downloads });
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Newest version")).toHaveText("0.1.30");
  const log = view.getByRole("region", { name: "Change log" });
  await expect(log.getByRole("listitem", { name: "contr 0.1.30" }).getByRole("listitem")).toHaveText(["Updates: read a release file, not the rate-limited API (#130)"]);
  await expect(log.getByRole("listitem", { name: "contr 0.1.24" }).getByLabel("Mark")).toHaveText("Installed");
  await view.getByRole("button", { name: "Update" }).click();
  await expect(view.getByRole("status")).toHaveText("Opened contr-mac-universal.dmg. Drag contr to Applications.");
  expect(readFileSync(path.join(downloads, "contr-mac-universal.dmg")).equals(DMG)).toBe(true);
  expect(paths.filter((p) => p.startsWith("/api/"))).toEqual([]);
  await app.close();
  server.close();
});

test("with no release.json (HTTP 404) the check and the change log read the API", async () => {
  const { server, url } = await fakeGitHub(404);
  const app = await launchApp(env(url));
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Newest version")).toHaveText("0.1.27");
  await expect(view.getByRole("region", { name: "Change log" }).getByRole("listitem", { name: "contr 0.1.27" }).getByRole("listitem")).toHaveText(["From the API (#110)"]);
  await app.close();
  server.close();
});

test("GitHub's rate limit says so in plain words, with the time a new check can pass", async () => {
  const { server, url } = await fakeGitHub(403);
  const app = await launchApp(env(url));
  const page = await app.firstWindow();
  const view = await openSettings(page);
  const text = "GitHub's limit for this network is reached. Try again after 14:05.";
  await expect(view.getByRole("alert").first()).toHaveText(`Update check failed: ${text}`);
  await expect(view.getByRole("region", { name: "Change log" })).toContainText(`Could not load the change log: ${text}`);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "update-rate-limit-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: path.join(shots, "update-rate-limit-light.png") });
  await app.close();
  server.close();
});
