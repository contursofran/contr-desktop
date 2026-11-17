import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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
/** Six releases in the API's order (not by time): 0.1.27 to 0.1.22; 0.1.23 has no "## Changes" part. */
const RELEASES = JSON.parse(readFileSync(path.join(e2e, "fixtures/releases.json"), "utf8")) as { body: string; published_at: string }[];

/** What the fake GitHub gives: `fail` answers HTTP 500, `hold` delays the answer, `extra` adds releases before the list. */
const fake: { fail: boolean; hold: Promise<void> | null; extra: unknown[] } = { fail: false, hold: null, extra: [] };

/** A fake GitHub: /releases (the change log, see `fake`) and /latest (the update check's newest release). */
async function fakeGitHub(): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    if (req.url === "/releases") {
      await fake.hold;
      if (fake.fail) res.statusCode = 500;
      res.end(fake.fail ? "" : JSON.stringify([...fake.extra, ...RELEASES]));
    } else if (req.url === "/latest") {
      res.end(JSON.stringify({ body: "contr 0.1.27 from 8e9dfad.", assets: [] }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

const openSettings = async (page: Page) => {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" });
};

test.beforeEach(() => {
  fake.fail = false;
  fake.hold = null;
  fake.extra = [];
});

test("the change log lists the newest releases first with marks, dates and changes; older ones behind Show older", async () => {
  const { server, url } = await fakeGitHub();
  const app = await launchApp({ ...base, CONTR_RELEASES_URL: `${url}/releases` });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "dark" });
  const view = await openSettings(page);
  const log = view.getByRole("region", { name: "Change log" });
  const items = log.getByRole("listitem").filter({ has: page.getByLabel("Date") });
  await expect(items).toHaveCount(3);
  await expect(items.getByLabel("Date")).toHaveText(["2026-11-17", "2026-11-16", "2026-11-16"]);
  const r27 = log.getByRole("listitem", { name: "contr 0.1.27" });
  await expect(r27.getByLabel("Mark")).toHaveText("New");
  await expect(r27.getByRole("listitem")).toHaveText(["Error and empty states: helper error as a block in the column (Fixes #99) (#110)", "Keys: card keys stay text in fields and menus (Fixes #101) (#109)", "Light theme: dim text reaches 4.5:1 (Fixes #102) (#106)"]);
  // "(#110)" stays plain text: no link.
  await expect(log.getByRole("link")).toHaveCount(0);
  await expect(log.getByRole("listitem", { name: "contr 0.1.25" }).getByLabel("Mark")).toHaveText("New");
  await expect(log.getByRole("listitem", { name: "contr 0.1.24" })).toHaveCount(0);
  await log.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "changelog-dark.png") });

  await log.getByRole("button", { name: "Show older" }).click();
  await expect(log.getByRole("button", { name: "Show older" })).toHaveCount(0);
  await expect(log.getByRole("listitem").filter({ has: page.getByLabel("Date") }).locator("span.font-mono.text-\\[13px\\]")).toHaveText(["0.1.27", "0.1.26", "0.1.25", "0.1.24", "0.1.23", "0.1.22"]);
  const installed = log.getByRole("listitem", { name: "contr 0.1.24" });
  await expect(installed.getByLabel("Mark")).toHaveText("Installed");
  await expect(installed.getByRole("listitem")).toHaveCount(2);
  // No "## Changes" part: version and date only.
  const bare = log.getByRole("listitem", { name: "contr 0.1.23" });
  await expect(bare.getByLabel("Date")).toHaveText("2026-11-14");
  await expect(bare.getByRole("list")).toHaveCount(0);
  await expect(bare.getByLabel("Mark")).toHaveCount(0);
  await expect(log.getByRole("listitem", { name: "contr 0.1.22" }).getByLabel("Mark")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "light" });
  await installed.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "changelog-older-light.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(shots, "changelog-older-dark.png") });
  await app.close();
  server.close();
});

test("the change log shows Loading while it reads, a failure text with Retry, and the list after Retry", async () => {
  const { server, url } = await fakeGitHub();
  let release = () => {};
  fake.hold = new Promise<void>((r) => (release = r));
  fake.fail = true;
  const app = await launchApp({ ...base, CONTR_RELEASES_URL: `${url}/releases` });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: "light" });
  const log = (await openSettings(page)).getByRole("region", { name: "Change log" });
  await expect(log.getByRole("status")).toHaveText("Loading the change log…");
  await page.screenshot({ path: path.join(shots, "changelog-loading-light.png") });
  release();
  await expect(log.getByRole("alert")).toHaveText("Could not load the change log: HTTP 500");
  await expect(log.getByRole("status")).toHaveCount(0);
  // The `error` token: 4.5:1 on `raised` in light (#117), `blocked`'s orange in dark.
  await expect(log.getByRole("alert")).toHaveCSS("color", "rgb(168, 80, 0)");
  await page.screenshot({ path: path.join(shots, "changelog-failed-light.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(log.getByRole("alert")).toHaveCSS("color", "rgb(255, 159, 10)");
  await page.screenshot({ path: path.join(shots, "changelog-failed-dark.png") });
  fake.fail = false;
  await log.getByRole("button", { name: "Retry" }).click();
  await expect(log.getByRole("listitem", { name: "contr 0.1.27" })).toBeVisible();
  await expect(log.getByRole("alert")).toHaveCount(0);
  await app.close();
  server.close();
});

test("each update check reads the change log again", async () => {
  const { server, url } = await fakeGitHub();
  const app = await launchApp({ ...base, CONTR_RELEASES_URL: `${url}/releases`, CONTR_UPDATE_URL: `${url}/latest` });
  const page = await app.firstWindow();
  const log = (await openSettings(page)).getByRole("region", { name: "Change log" });
  await expect(log.getByRole("listitem", { name: "contr 0.1.27" })).toBeVisible();
  const r = RELEASES[0];
  fake.extra = [{ ...r, tag_name: "build-2026-11-18-4444444", published_at: "2026-11-18T08:00:00Z", body: "contr 0.1.28 from 4444444.\n\n## Changes\n\n- Settings: the change log of each release (#121)\n" }];
  await page.getByRole("region", { name: "Settings" }).getByRole("button", { name: "Check now" }).click();
  const r28 = log.getByRole("listitem", { name: "contr 0.1.28" });
  await expect(r28.getByRole("listitem")).toHaveText(["Settings: the change log of each release (#121)"]);
  await expect(r28.getByLabel("Mark")).toHaveText("New");
  await app.close();
  server.close();
});

test("with no releases URL (dev, e2e) there is no change log part", async () => {
  const app = await launchApp(base);
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Newest version")).toHaveText("Development build");
  await expect(view.getByText("Change log")).toHaveCount(0);
  await app.close();
});
