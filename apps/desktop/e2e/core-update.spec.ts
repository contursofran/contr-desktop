import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const fake = path.join(e2e, "fake-helper.mjs");
const fakeCore = path.join(e2e, "fixtures/core/fake-core-helper.mjs");
/** The fake hc, git and chat fixture: no run reads the owner's hc or repositories. */
const fakes = {
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};
const dirs: string[] = [];
const temp = (name: string) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), `contr-e2e-${name}-`));
  dirs.push(dir);
  return dir;
};
test.afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp bundle (the fake helper, the tag of 2026-11-10) and a temp core home of 2026-11-17 that runs. */
function setup(record: object = {}) {
  const bin = temp("bundle");
  symlinkSync(fake, path.join(bin, "herdr-contr-feed"));
  writeFileSync(path.join(bin, "RELEASE"), "build-2026-11-10-aaaaaaa\n");
  const core = temp("core");
  mkdirSync(path.join(core, "bin"));
  symlinkSync(fakeCore, path.join(core, "bin", "herdr-contr-feed"));
  writeFileSync(path.join(core, "install.json"), JSON.stringify({ build: "bbbbbbb 2026-11-17", ...record }));
  const log = path.join(temp("log"), "core.log");
  return { bin, core, log, env: { ...fakes, CONTR_CORE_HOME: core, CONTR_CORE_BUNDLE: bin, FAKE_CORE_LOG: log } };
}

const calls = (log: string) => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { args: string[]; home: string | null }) : []);

async function coreCard(page: Page) {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" }).getByRole("region", { name: "Core" });
}

test("the helper check reports the newer core and update availability", async () => {
  const { core, env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc" });
  const page = await app.firstWindow();
  await expect(page.getByLabel("Update ready")).toBeVisible();
  const card = await coreCard(page);
  await expect(card.getByLabel("Core version", { exact: true })).toHaveText("bbbbbbb 2026-11-17");
  await expect(card.getByLabel("Newest core version")).toHaveText("ccccccc 2026-11-20");
  await expect(card.getByLabel("Core folder")).toHaveText(core);
  await app.close();
});

test("the helper check error reaches Settings", async () => {
  const { env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc", FAKE_CORE_FAIL: "check:http" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByRole("alert")).toHaveText("Core check failed: fake http");
  await app.close();
});

test("Check now asks with --force, the open of Settings does not", async () => {
  const { env, log } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-17-bbbbbbb" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByLabel("Newest core version")).toHaveText("Up to date");
  const checks = () => calls(log).filter((c) => c.args[0] === "update").map((c) => c.args.join(" "));
  expect(checks().every((c) => c === "update check")).toBe(true);
  await card.getByRole("button", { name: "Check now" }).click();
  await expect.poll(checks).toContain("update check --force");
  await app.close();
});

test("a shared root runs the bundled core without calling update or install", async () => {
  const { env, log } = setup({ files: { "kit/x": "1" } });
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByRole("status")).toHaveText("The Herdr app uses this core. contr runs its own copy and does not change this folder.");
  await expect(card.getByLabel("Core version", { exact: true })).toHaveText("aaaaaaa 2026-11-10");
  expect(calls(log).filter((c) => c.args[0] === "update" || c.args[0] === "install")).toEqual([]);
  await app.close();
});

const tag = "build-2026-11-20-ccccccc";
const updateButton = (card: ReturnType<Page["getByRole"]>) => card.getByRole("button", { name: "Update", exact: true });

async function shots(card: ReturnType<Page["getByRole"]>, state: string) {
  for (const scheme of ["dark", "light"] as const) {
    await card.page().emulateMedia({ colorScheme: scheme });
    await card.screenshot({ path: path.resolve(e2e, `../../../tmp/shots/core-update-${state}-${scheme}.png`) });
  }
}

test("a press updates the core, says what new sessions get, and the chat goes on", async () => {
  const { core, env, log } = setup();
  const fixture = path.join(temp("fixture"), "session.jsonl");
  copyFileSync(env.FAKE_HELPER_FIXTURE, fixture);
  const app = await launchApp({ ...env, FAKE_HELPER_FIXTURE: fixture, FAKE_CORE_NEWEST: tag, FAKE_CORE_SLOW: "4000" }, temp("data"));
  try {
    const page = await app.firstWindow();
    await expect(page.getByText("Hashing…")).toBeVisible();
    const card = await coreCard(page);
    await expect(updateButton(card)).toBeEnabled();
    await expect(card.getByRole("button", { name: "Check now" })).toBeEnabled();
    await shots(card, "available");
    await updateButton(card).click();
    await expect(card.getByRole("button", { name: "Updating…" })).toBeDisabled();
    await shots(card, "updating");
    await expect(card.getByRole("status")).toHaveText("Updated to ccccccc 2026-11-20. New agent sessions use the new kit. Agents that run now keep the kit they started with.");
    await expect(card.getByLabel("Newest core version")).toHaveText("Up to date");
    await expect(page.getByLabel("Update ready")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Check now" })).toBeEnabled();
    await shots(card, "done");

    await expect.poll(() => {
      const entries = calls(log);
      const install = entries.findIndex(({ args, home }) => home === core && args.join(" ") === "update install");
      return install >= 0 && entries.slice(install + 1).some(({ args }) => args[0] === "feed" && !args.includes("--cursor"));
    }).toBe(true);

    await page.getByRole("tab", { name: "Chat panel usability audit" }).click();
    appendFileSync(fixture, JSON.stringify({ id: "after-update", k: "assistant", text: "The new helper reads this row.", ts: Date.now() }) + "\n");
    await expect(page.getByText("The new helper reads this row.")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("a failed update shows its text and keeps Update", async () => {
  const { core, env } = setup();
  const record = path.join(core, "install.json");
  const before = readFileSync(record, "utf8");
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: tag, FAKE_CORE_FAIL: "install:unzip" }, temp("data"));
  try {
    const card = await coreCard(await app.firstWindow());
    await updateButton(card).click();
    await expect(card.getByRole("alert")).toHaveText("Core update failed: fake unzip");
    await expect(updateButton(card)).toBeEnabled();
    expect(readFileSync(record, "utf8")).toBe(before);
    await shots(card, "error");
  } finally {
    await app.close();
  }
});

test("an updated core that does not start falls back to the bundle", async () => {
  const { bin, core, env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: tag, FAKE_CORE_FAIL: "start" }, temp("data"));
  try {
    const page = await app.firstWindow();
    const card = await coreCard(page);
    await expect(page.getByLabel("Helper path")).toHaveText(path.join(core, "bin", "herdr-contr-feed"));
    await updateButton(card).click();
    await expect(card.getByRole("alert")).toHaveText("The core in this folder does not start. contr runs its own copy.");
    await expect(page.getByLabel("Helper path")).toHaveText(path.join(bin, "herdr-contr-feed"));
  } finally {
    await app.close();
  }
});
