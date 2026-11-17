import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setCore } from "../core/current";
import { binPath } from "./binPath";
import { helperPath } from "./run";

describe("binPath", () => {
  it("takes the override first", () => {
    expect(binPath("x", "/R/app.asar", "/o/x")).toBe("/o/x");
  });
  it("uses Resources/bin in the packaged app", () => {
    expect(binPath("herdr-contr-orch", "/A.app/Contents/Resources/app.asar")).toBe(
      "/A.app/Contents/Resources/bin/herdr-contr-orch",
    );
  });
  it("uses bin/ at the repository root in dev", () => {
    expect(binPath("herdr-contr-feed", "/r/apps/desktop")).toBe("/r/bin/herdr-contr-feed");
  });
  it("takes the bundle folder in place of either", () => {
    expect(binPath("herdr-contr-feed", "/r/apps/desktop", undefined, "/b")).toBe("/b/herdr-contr-feed");
  });
});

describe("helperPath", () => {
  afterEach(() => setCore({ source: "bundle", root: null }));
  it("CONTR_HELPER wins over the home", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "contr-core-test-"));
    mkdirSync(path.join(root, "bin"));
    writeFileSync(path.join(root, "bin", "herdr-contr-feed"), "");
    setCore({ source: "home", root });
    expect(helperPath("/r/apps/desktop", { CONTR_HELPER: "/o/helper" })).toBe("/o/helper");
    expect(helperPath("/r/apps/desktop", {})).toBe(path.join(root, "bin", "herdr-contr-feed"));
  });
});
