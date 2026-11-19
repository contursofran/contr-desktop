import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApp } from "../../../e2e/fake-app";
import { bundleOf, stageZip, SWAP_SCRIPT, unpack, writable } from "./install";

const mac = process.platform === "darwin";
const version = (app: string) => execFileSync("plutil", ["-extract", "CFBundleShortVersionString", "raw", path.join(app, "Contents/Info.plist")]).toString().trim();
const digest = (zip: string) => createHash("sha256").update(readFileSync(zip)).digest("hex");
let tmp: string;
const remaining = () => readdirSync(tmp).filter((name) => name.startsWith("contr-zip-") || name.startsWith("contr-update-"));

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "contr-install-test-"));
  vi.spyOn(os, "tmpdir").mockReturnValue(tmp);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

describe("bundleOf", () => {
  it("gives the .app that holds the executable", () => expect(bundleOf("/Apps/contr.app/Contents/MacOS/contr")).toBe("/Apps/contr.app"));
  it("gives null out of a bundle", () => expect(bundleOf("/usr/bin/node")).toBeNull());
});

describe("writable", () => {
  it("is true for a scratch folder and false for a missing one", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-w-"));
    expect(writable(dir)).toBe(true);
    expect(writable(path.join(dir, "missing"))).toBe(false);
  });
  it("is false for a read-only folder", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-w-"));
    chmodSync(dir, 0o555);
    expect(writable(dir)).toBe(false);
    chmodSync(dir, 0o755);
  });
});

describe("ZIP verification", () => {
  it.each([
    ["mismatch", "0".repeat(64), "The .zip does not match the release SHA-256."],
    ["missing", null, "The release has no valid SHA-256 for the .zip."],
  ])("refuses a %s hash before unpacking and removes the archive", async (_case, sha256, error) => {
    await expect(stageZip(async (file) => writeFileSync(file, "bad zip"), "9.1.42", sha256)).rejects.toThrow(error);
    expect(remaining()).toEqual([]);
  });

  it("removes a partial archive when the download fails", async () => {
    await expect(stageZip(async (file) => {
      writeFileSync(file, "partial zip");
      throw new Error("Download interrupted");
    }, "9.1.42", null)).rejects.toThrow("Download interrupted");
    expect(remaining()).toEqual([]);
  });
});

describe.runIf(mac)("unpack", () => {
  const unpackChecked = (zip: string, expected: string) => unpack(zip, expected, digest(zip));
  it("keeps the checked app and removes the archive when the hash matches", async () => {
    const { zip } = fakeApp("9.1.42");
    const app = await stageZip(async (file) => copyFileSync(zip, file), "9.1.42", digest(zip));
    expect(path.basename(app)).toBe("contr.app");
    expect(version(app)).toBe("9.1.42");
    expect(remaining()).toEqual([path.basename(path.dirname(app))]);
  });
  it("removes the stage when the version is not the release's", async () => {
    await expect(unpackChecked(fakeApp("9.1.41").zip, "9.1.42")).rejects.toThrow("The app in the .zip is 9.1.41, not 9.1.42.");
    expect(remaining()).toEqual([]);
  });
  it("throws when codesign --verify fails", async () => {
    await expect(unpackChecked(fakeApp("9.1.42", false).zip, "9.1.42")).rejects.toThrow("fails codesign --verify");
  });
  it("throws when the .zip has no app", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-z-"));
    writeFileSync(path.join(dir, "x.txt"), "x");
    execFileSync("ditto", ["-c", "-k", dir, path.join(dir, "x.zip")]);
    await expect(unpackChecked(path.join(dir, "x.zip"), "1.0.0")).rejects.toThrow("The .zip has no app.");
  });
});

describe.runIf(mac)("the swap script", () => {
  /** Runs the script on a scratch install folder; the fake open writes each opened path to a log. */
  const swap = (running: boolean, next?: string) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contr-swap-test-"));
    const app = path.join(dir, "contr.app");
    execFileSync("ditto", [fakeApp("1.0.0").app, app]);
    const nextApp = next ?? fakeApp("2.0.0").app;
    const script = path.join(dir, "swap.sh");
    const log = path.join(dir, "open.log");
    writeFileSync(script, SWAP_SCRIPT);
    const open = path.join(dir, "open.sh");
    writeFileSync(open, `#!/bin/sh\necho "$1" >> "${log}"\n`, { mode: 0o755 });
    const done = spawnSync("/bin/sh", [script, "999999", app, nextApp], { env: { ...process.env, SWAP_OPEN: open, SWAP_RUNNING: running ? "true" : "false", SWAP_WAIT: "0" } });
    return { app, stage: path.dirname(nextApp), code: done.status, opened: readFileSync(log, "utf8").trim() };
  };
  it("puts the new app in place, opens it and removes the old copy", () => {
    const r = swap(true);
    expect(r.code).toBe(0);
    expect(version(r.app)).toBe("2.0.0");
    expect(existsSync(`${r.app}.old`)).toBe(false);
    expect(existsSync(r.stage)).toBe(false);
    expect(r.opened).toBe(r.app);
  });
  it("puts the old app back and opens it when the new one does not run", () => {
    const r = swap(false);
    expect(r.code).toBe(1);
    expect(version(r.app)).toBe("1.0.0");
    expect(existsSync(`${r.app}.old`)).toBe(false);
    expect(existsSync(r.stage)).toBe(false);
    expect(r.opened).toBe(`${r.app}\n${r.app}`);
  });
  it("puts the old app back when the new app is missing", () => {
    const missing = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-m-")), "contr.app");
    const r = swap(true, missing);
    expect(r.code).toBe(1);
    expect(version(r.app)).toBe("1.0.0");
    expect(r.opened).toBe(r.app);
  });
});
