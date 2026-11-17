import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setCore } from "./current";
import { CORE_NOT_START, coreInstallFailed, startCore } from "./start";

// A temp folder stands in for the home folder: no test reads a folder under the real home.
const temp = () => mkdtempSync(path.join(os.tmpdir(), "contr-start-test-"));

function setup(old: boolean) {
  const home = temp();
  if (old) mkdirSync(path.join(home, ".config", "herdr-app", "herdr-contr"), { recursive: true });
  const env = { CONTR_E2E: "1", CONTR_CORE_HOME: path.join(home, ".config", "contr-core"), CONTR_CORE_BUNDLE: temp() };
  return { home, env };
}

describe("startCore", () => {
  afterEach(() => setCore({ source: "bundle", root: null }));
  it("no install into contr-core while an older folder exists", async () => {
    const { home, env } = setup(true);
    const install = vi.fn(async () => ({ ok: true as const }));
    const core = await startCore("/r/apps/desktop", false, env, home, install);
    expect(install).not.toHaveBeenCalled();
    expect(core).toMatchObject({ source: "bundle", error: null });
  });
  it("with no older folder the bundle's core goes into contr-core", async () => {
    const { home, env } = setup(false);
    const install = vi.fn(async () => ({ ok: true as const }));
    // The fake install writes nothing, so the home's helper does not start: T8.
    const core = await startCore("/r/apps/desktop", false, env, home, install);
    expect(install).toHaveBeenCalledWith(path.join(env.CONTR_CORE_BUNDLE, "herdr-contr-feed"), null, env.CONTR_CORE_HOME);
    expect(core).toMatchObject({ source: "bundle", error: CORE_NOT_START });
  });
  it("a failed install keeps the bundle and its text", async () => {
    const { home, env } = setup(false);
    const core = await startCore("/r/apps/desktop", false, env, home, async () => ({ ok: false, message: "STOP: fake" }));
    expect(core).toMatchObject({ source: "bundle", error: coreInstallFailed("STOP: fake") });
  });
});
