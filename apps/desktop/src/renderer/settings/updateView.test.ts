import { describe, expect, it } from "vitest";
import type { UpdateState } from "../../shared/api";
import { updateView } from "./updateView";

const T = 1_000_000;
const base: UpdateState = { current: "0.1.1", dev: false, latest: null, available: false, progress: null, downloaded: null, ready: false, error: null, checking: false, checked: null, checkFailed: false };
const at = (change: Partial<UpdateState>) => updateView({ ...base, ...change }, T);

describe("updateView", () => {
  it("before the state comes: Checking… and nothing else", () => {
    expect(updateView(undefined, T)).toEqual({ newest: "Checking…", check: null, action: null, lastCheck: null, progress: null, status: null, error: null });
  });

  it("dev: Development build, no Check now", () => {
    expect(at({ dev: true })).toMatchObject({ newest: "Development build", check: null, action: null, lastCheck: null });
  });

  it("the first check runs: Checking… on the row and the disabled button", () => {
    expect(at({ checking: true })).toMatchObject({ newest: "Checking…", check: { label: "Checking…", disabled: true }, lastCheck: null });
  });

  it("a passed check, same version: Up to date and Checked just now", () => {
    expect(at({ latest: "0.1.1", checked: T })).toMatchObject({ newest: "Up to date", check: { label: "Check now", disabled: false }, action: null, lastCheck: "Checked just now", error: null });
  });

  it("a passed check, newer version: the version and Update", () => {
    expect(at({ latest: "0.1.2", available: true, checked: T - 5 * 60_000 })).toMatchObject({ newest: "0.1.2", action: { kind: "update", label: "Update", disabled: false }, lastCheck: "Checked 5m ago" });
  });

  it("a download runs: its percent on the disabled button and the bar", () => {
    expect(at({ latest: "0.1.2", available: true, checked: T, progress: 40 })).toMatchObject({ action: { kind: "update", label: "Downloading 40%", disabled: true }, progress: 40 });
  });

  it("the .zip is ready: Restart to update", () => {
    expect(at({ latest: "0.1.2", available: true, checked: T, ready: true })).toMatchObject({ newest: "0.1.2", action: { kind: "restart", label: "Restart to update" } });
  });

  it("the .dmg is opened: its file name, not its folder", () => {
    expect(at({ latest: "0.1.2", available: true, checked: T, downloaded: "/var/folders/x/T/contr-mac-universal.dmg" }).status).toBe("Opened contr-mac-universal.dmg. Drag contr to Applications.");
  });

  it("a failed download: its message, the check line stays", () => {
    expect(at({ latest: "0.1.2", available: true, checked: T, error: "Download failed: HTTP 500" })).toMatchObject({ error: "Download failed: HTTP 500", lastCheck: "Checked just now", action: { kind: "update", label: "Update" } });
  });

  it("a failed check after a passed one: the failure, no Checked line, the known release stays", () => {
    const v = at({ latest: "0.1.2", available: true, checked: T, checkFailed: true, error: "Update check failed: HTTP 500" });
    expect(v).toMatchObject({ newest: "0.1.2", lastCheck: null, error: "Update check failed: HTTP 500", action: { kind: "update", label: "Update" } });
  });

  it("a failed check does not say Up to date", () => {
    expect(at({ latest: "0.1.1", checked: T, checkFailed: true, error: "Update check failed: HTTP 500" }).newest).toBe("0.1.1");
  });

  it("a failed first check: Unknown, not Checking…", () => {
    expect(at({ checked: T, checkFailed: true, error: "Update check failed: HTTP 500" })).toMatchObject({ newest: "Unknown", check: { label: "Check now" }, lastCheck: null });
  });

  it("a new check after a failure: Checking…, the old failure hidden until it ends", () => {
    expect(at({ checked: T, checkFailed: true, error: "Update check failed: HTTP 500", checking: true })).toMatchObject({ newest: "Checking…", check: { label: "Checking…", disabled: true }, lastCheck: null, error: null });
  });
});
