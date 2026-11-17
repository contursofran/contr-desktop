import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
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
const temp = (name: string) => mkdtempSync(path.join(os.tmpdir(), `contr-e2e-${name}-`));

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
  return { core, log, env: { ...fakes, CONTR_CORE_HOME: core, CONTR_CORE_BUNDLE: bin, FAKE_CORE_LOG: log } };
}

const calls = (log: string) => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { args: string[]; home: string | null }) : []);

async function coreCard(page: Page) {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" }).getByRole("region", { name: "Core" });
}

/** Screenshots in dark and light, after each check ended. */
async function shoot(page: Page, name: string) {
  await expect(page.getByRole("button", { name: "Checking…" })).toHaveCount(0);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `core-${name}-${scheme}.png`) });
  }
}

test("a newer core shows its stamp, Update and the dot", async () => {
  const { core, env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc" });
  const page = await app.firstWindow();
  await expect(page.getByLabel("Update ready")).toBeVisible();
  const card = await coreCard(page);
  await expect(card.getByLabel("Core version", { exact: true })).toHaveText("bbbbbbb 2026-11-17");
  await expect(card.getByLabel("Newest core version")).toHaveText("ccccccc 2026-11-20");
  await expect(card.getByRole("button", { name: "Update" })).toBeVisible();
  await expect(card.getByLabel("Core folder")).toHaveText(core);
  await shoot(page, "newer");
  await app.close();
});

test("the same core says Up to date", async () => {
  const { env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-17-bbbbbbb" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByLabel("Newest core version")).toHaveText("Up to date");
  await expect(card.getByLabel("Last core check")).toHaveText("Checked just now");
  await expect(card.getByRole("button", { name: "Update" })).toHaveCount(0);
  await expect(page.getByLabel("Update ready")).toHaveCount(0);
  await shoot(page, "same");
  await app.close();
});

test("a failed check shows its text and Unknown", async () => {
  const { env } = setup();
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc", FAKE_CORE_FAIL: "check:http" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByRole("alert")).toHaveText("Core check failed: fake http");
  await expect(card.getByLabel("Newest core version")).toHaveText("Unknown");
  await expect(card.getByText("Up to date")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Check now" })).toBeEnabled();
  await shoot(page, "failed");
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

test("a shared root shows the Herdr text and no Check now", async () => {
  const { env, log } = setup({ files: { "kit/x": "1" } });
  const app = await launchApp({ ...env, FAKE_CORE_NEWEST: "build-2026-11-20-ccccccc" });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByRole("status")).toHaveText("The Herdr app uses this core. contr runs its own copy and does not change this folder.");
  await expect(card.getByLabel("Core version", { exact: true })).toHaveText("aaaaaaa 2026-11-10");
  await expect(card.getByRole("button", { name: "Check now" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Update" })).toHaveCount(0);
  await expect(page.getByLabel("Update ready")).toHaveCount(0);
  await shoot(page, "shared");
  expect(calls(log).filter((c) => c.args[0] === "update" || c.args[0] === "install")).toEqual([]);
  await app.close();
});

test("with no core root the Core part says Development build", async () => {
  const app = await launchApp({ ...fakes, CONTR_HELPER: fake });
  const page = await app.firstWindow();
  const card = await coreCard(page);
  await expect(card.getByLabel("Newest core version")).toHaveText("Development build");
  await expect(card.getByRole("button", { name: "Check now" })).toHaveCount(0);
  await expect(card.getByLabel("Core folder")).toHaveCount(0);
  await shoot(page, "dev");
  await app.close();
});
