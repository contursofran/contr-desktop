import { expect, test, type Page } from "@playwright/test";
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");
const fake = path.join(e2e, "fake-helper.mjs");
/** The fake helper with a `version` answer, for a core home. */
const fakeCore = path.join(e2e, "fixtures/core/fake-core-helper.mjs");
const temp = (name: string) => mkdtempSync(path.join(os.tmpdir(), `contr-e2e-${name}-`));

/** A temp bundle: the fake helper and the release tag of 2026-11-10. */
function bundle(): string {
  const dir = temp("bundle");
  symlinkSync(fake, path.join(dir, "herdr-contr-feed"));
  writeFileSync(path.join(dir, "RELEASE"), "build-2026-11-10-aaaaaaa\n");
  return dir;
}

/** A temp core home with a helper (the fake, or a program that fails) and an install.json. */
function home(helper: "fake" | "broken", record: object): string {
  const dir = temp("core");
  mkdirSync(path.join(dir, "bin"));
  const file = path.join(dir, "bin", "herdr-contr-feed");
  if (helper === "fake") symlinkSync(fakeCore, file);
  else {
    writeFileSync(file, "#!/bin/sh\nexit 1\n");
    chmodSync(file, 0o755);
  }
  writeFileSync(path.join(dir, "install.json"), JSON.stringify(record));
  return dir;
}

const env = (core: string, bin: string) => ({
  CONTR_CORE_HOME: core,
  CONTR_CORE_BUNDLE: bin,
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
});

async function helperShown(page: Page): Promise<ReturnType<Page["getByRole"]>> {
  await page.locator("aside > footer").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("region", { name: "Settings" });
}

test("a newer home's helper is the one in Settings", async () => {
  const core = home("fake", { build: "bbbbbbb 2026-11-17" });
  const app = await launchApp(env(core, bundle()));
  const page = await app.firstWindow();
  // The working line comes from the home's helper.
  await expect(page.getByText("Hashing…")).toBeVisible();
  const view = await helperShown(page);
  await expect(view.getByLabel("Helper path")).toHaveText(path.join(core, "bin", "herdr-contr-feed"));
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `core-home-${scheme}.png`) });
  }
  await app.close();
});

test("a home whose helper does not start falls back to the bundle", async () => {
  const bin = bundle();
  const app = await launchApp(env(home("broken", { build: "bbbbbbb 2026-11-17" }), bin));
  const page = await app.firstWindow();
  const view = await helperShown(page);
  await expect(view.getByLabel("Helper path")).toHaveText(path.join(bin, "herdr-contr-feed"));
  await page.screenshot({ path: path.join(shots, "core-broken-dark.png") });
  await app.close();
});

test("a root shared with the Herdr app runs the bundle", async () => {
  const bin = bundle();
  const app = await launchApp(env(home("fake", { build: "bbbbbbb 2026-11-17", files: { "kit/x": "1" } }), bin));
  const page = await app.firstWindow();
  const view = await helperShown(page);
  await expect(view.getByLabel("Helper path")).toHaveText(path.join(bin, "herdr-contr-feed"));
  await app.close();
});
