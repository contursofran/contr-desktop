import { expect, test } from "@playwright/test";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FAKES, launchEnv } from "./launch-env";

// The launcher's environment, with no Electron: no spec reaches a real program by leaving a switch out (#166).
const e2e = import.meta.dirname;
const temp = () => mkdtempSync(path.join(os.tmpdir(), "contr-e2e-launch-"));
// A shell as the owner's: the real programs on PATH and set as switches, and the default hc session.
const shell = { PATH: "/usr/bin:/bin", CONTR_HC: "/usr/local/bin/hc", CONTR_GIT: "/usr/bin/git", CONTR_HC_SESSION: "default", CONTR_CORE_HOME: "/x" };

test("with no switches the environment names the fakes", () => {
  const env = launchEnv({}, shell);
  expect(env.CONTR_HC).toBe(path.join(e2e, "fake-hc.mjs"));
  expect(env.CONTR_HELPER).toBe(path.join(e2e, "fake-helper.mjs"));
  expect(env.CONTR_ORCH).toBe(path.join(e2e, "fake-orch.mjs"));
  expect(env.CONTR_GIT).toBe(path.join(e2e, "fake-git.mjs"));
  expect(env.CONTR_GH).toBe(path.join(e2e, "fake-gh.mjs"));
  expect(env.FAKE_ORCH_NONE).toBe("1");
  expect(env.CONTR_E2E).toBe("1");
  expect(env.CONTR_TERMINAL).toBe("t1");
  expect(env.CONTR_HC_SESSION).toBeUndefined();
  expect(env.CONTR_CORE_HOME).toBeUndefined();
  expect(env.PATH).toBe(shell.PATH);
});

test("a spec names another fake: in the repository, in the temp folder, or a missing one", () => {
  const dir = temp();
  const file = path.join(dir, "hc");
  writeFileSync(file, "");
  const env = launchEnv({ CONTR_HC: file, CONTR_ORCH: FAKES.CONTR_ORCH, CONTR_HELPER: path.join(e2e, "missing", "helper") }, shell);
  expect(env.CONTR_HC).toBe(file);
  expect(env.CONTR_ORCH).toBe(FAKES.CONTR_ORCH);
  expect(env.FAKE_ORCH_NONE).toBeUndefined();
  expect(env.CONTR_HELPER).toBe(path.join(e2e, "missing", "helper"));
});

test("a program outside the repository and the temp folder throws", () => {
  for (const value of ["/usr/bin/git", "/nonexistent/hc", "hc", "git"]) {
    expect(() => launchEnv({ CONTR_GIT: value }, shell)).toThrow(/CONTR_GIT must be a file in the repository/);
  }
});

test("a link in the temp folder to a real program throws, and so does a folder", () => {
  const dir = temp();
  const link = path.join(dir, "gh");
  symlinkSync("/bin/sh", link);
  expect(() => launchEnv({ CONTR_GH: link }, shell)).toThrow(/CONTR_GH must be a file/);
  expect(() => launchEnv({ CONTR_HC: dir }, shell)).toThrow(/CONTR_HC must be a file/);
});

test("the repository's bin/ (the real core programs) throws", () => {
  const real = path.resolve(e2e, "../../../bin/herdr-contr-feed");
  expect(() => launchEnv({ CONTR_HELPER: real }, shell)).toThrow(/CONTR_HELPER must be a file/);
});

test("with a core bundle the helper comes from the core, and a core home needs a bundle", () => {
  const bundle = temp();
  const env = launchEnv({ CONTR_CORE_HOME: temp(), CONTR_CORE_BUNDLE: bundle }, shell);
  expect(env.CONTR_HELPER).toBeUndefined();
  expect(env.CONTR_CORE_BUNDLE).toBe(bundle);
  expect(env.CONTR_HC).toBe(FAKES.CONTR_HC);
  expect(() => launchEnv({ CONTR_CORE_HOME: temp() }, shell)).toThrow(/needs CONTR_CORE_BUNDLE/);
  expect(() => launchEnv({ CONTR_CORE_HOME: temp(), CONTR_CORE_BUNDLE: "/opt/bundle" }, shell)).toThrow(/CONTR_CORE_BUNDLE must be in/);
  expect(() => launchEnv({ CONTR_CORE_HOME: "/x" }, shell)).toThrow(/CONTR_CORE_HOME must be in/);
});

test("the real-hc option runs hc on the scratch session only", () => {
  const env = launchEnv({ CONTR_TERMINAL: "t3" }, { ...shell, HC_SESSION: "default" }, { realHcSession: "cde42" });
  expect(env.CONTR_HC).toBe("hc");
  expect(env.HC_SESSION).toBe("cde42");
  expect(env.CONTR_HC_SESSION).toBe("cde42");
  expect(env.CONTR_GIT).toBe(FAKES.CONTR_GIT);
  expect(() => launchEnv({}, shell, { realHcSession: "" })).toThrow(/scratch session name/);
  expect(() => launchEnv({ HC_SESSION: "default" }, shell, { realHcSession: "cde42" })).toThrow(/sets HC_SESSION/);
  expect(() => launchEnv({ CONTR_HC: FAKES.CONTR_HC }, shell, { realHcSession: "cde42" })).toThrow(/sets CONTR_HC/);
});
