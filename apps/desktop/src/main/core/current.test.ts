import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { corePath, setCore } from "./current";

const temp = () => mkdtempSync(path.join(os.tmpdir(), "contr-core-test-"));
const helperIn = (root: string) => {
  mkdirSync(path.join(root, "bin"), { recursive: true });
  const file = path.join(root, "bin", "herdr-contr-feed");
  writeFileSync(file, "#!/bin/sh\n");
  chmodSync(file, 0o755);
  return file;
};

describe("corePath", () => {
  afterEach(() => setCore({ source: "bundle", root: null }));
  it("runs the home's program when the source is home and it exists", () => {
    const root = temp();
    const file = helperIn(root);
    setCore({ source: "home", root });
    expect(corePath("herdr-contr-feed", "/A.app/Contents/Resources/app.asar", undefined, {})).toBe(file);
    // The home has no tool: the bundle's.
    expect(corePath("herdr-contr-orch", "/A.app/Contents/Resources/app.asar", undefined, {})).toBe("/A.app/Contents/Resources/bin/herdr-contr-orch");
  });
  it("a bundle source runs CONTR_CORE_BUNDLE only in e2e", () => {
    const root = temp();
    helperIn(root);
    setCore({ source: "bundle", root });
    expect(corePath("herdr-contr-feed", "/r/apps/desktop", undefined, {})).toBe("/r/bin/herdr-contr-feed");
    const env = { CONTR_CORE_BUNDLE: "/b" };
    expect(corePath("herdr-contr-feed", "/r/apps/desktop", undefined, env)).toBe("/r/bin/herdr-contr-feed");
    expect(corePath("herdr-contr-feed", "/r/apps/desktop", undefined, { ...env, CONTR_E2E: "1" })).toBe("/b/herdr-contr-feed");
  });
});
