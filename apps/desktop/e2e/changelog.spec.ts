import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const base = {
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
  CONTR_VERSION: "0.1.24",
};
/** Six releases in the API's order, with 0.1.24 first; 0.1.23 has no "## Changes" part. */
const RELEASES = JSON.parse(readFileSync(path.join(e2e, "fixtures/releases.json"), "utf8")) as { body: string; published_at: string }[];

/** What the fake GitHub gives: `fail` answers HTTP 500 and `extra` adds releases before the list. */
const fake: { fail: boolean; extra: unknown[] } = { fail: false, extra: [] };

/** A fake GitHub: /releases (the change log, see `fake`) and /latest (the update check's newest release). */
async function fakeGitHub(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    if (req.url === "/releases") {
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
  fake.extra = [];
});

test("Retry recovers from a change log HTTP failure", async () => {
  const { server, url } = await fakeGitHub();
  fake.fail = true;
  const app = await launchApp({ ...base, CONTR_RELEASES_URL: `${url}/releases` });
  const page = await app.firstWindow();
  const log = (await openSettings(page)).getByRole("region", { name: "Change log" });
  await expect(log.getByRole("alert")).toHaveText("Could not load the change log: HTTP 500");
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
  const versions = await page.evaluate(async () => (await window.contr.changeLog()).releases?.map((r) => r.version));
  expect(versions).toEqual(["0.1.28", "0.1.27", "0.1.26", "0.1.25", "0.1.24", "0.1.23", "0.1.22"]);
  await app.close();
  server.close();
});

test("with no releases URL (dev, e2e) there is no change log part", async () => {
  const app = await launchApp(base);
  const page = await app.firstWindow();
  const view = await openSettings(page);
  await expect(view.getByLabel("Newest version")).toHaveText("Development build");
  await expect(view.getByText("Change log")).toHaveCount(0);
  const core = view.getByRole("region", { name: "Core" });
  await expect(core.getByLabel("Newest core version")).toHaveText("Development build");
  await expect(core.getByLabel("Core folder")).toHaveCount(0);
  await expect(core.getByRole("button", { name: "Check now" })).toHaveCount(0);
  await app.close();
});
